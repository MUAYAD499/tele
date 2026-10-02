import asyncio
import logging
from datetime import datetime
from telethon.errors import (
    FloodWaitError,
    ChatForwardsRestrictedError,
    UserIsBlockedError,
    PeerIdInvalidError,
    UsernameNotOccupiedError,
    UsernameInvalidError,
    RPCError
)

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models.message import ProcessedMessage
from backend.app.models.recipient import Recipient
from backend.app.models.group import MonitoredGroup
from backend.app.models.log import ForwardLog
from backend.app.models.settings import SystemSetting
from backend.app.services.queue_manager import queue_manager, QueueItem
from backend.app.services.telegram_client import telegram_service

logger = logging.getLogger("forward_worker")


class ForwardWorker:
    def __init__(self):
        self.is_running = True

    async def start(self):
        logger.info("Forward worker started. Listening to queue...")
        while self.is_running:
            try:
                # Wait for next queued message item
                item: QueueItem = await queue_manager.get()
                await self.process_item(item)
                queue_manager.task_done()
            except asyncio.CancelledError:
                logger.info("Forward worker cancelled.")
                break
            except Exception as e:
                logger.error("Unexpected exception in forward worker loop: %s", str(e), exc_info=True)
                await asyncio.sleep(1)

    async def process_item(self, item: QueueItem):
        """Processes a single queued message item for all recipients."""
        db = SessionLocal()
        try:
            # Fetch current system forward delay setting
            delay_setting = db.query(SystemSetting).filter(SystemSetting.key == "FORWARD_DELAY").first()
            forward_delay = float(delay_setting.value) if delay_setting else settings.FORWARD_DELAY

            for recipient_username in item.recipients:
                # 1. Deduplication check (chat_id + message_id + recipient)
                already_processed = db.query(ProcessedMessage).filter(
                    ProcessedMessage.chat_id == item.chat_id,
                    ProcessedMessage.message_id == item.message_id,
                    ProcessedMessage.recipient == recipient_username
                ).first()

                if already_processed:
                    logger.info(
                        "Skipping duplicate: chat=%s msg=%s recipient=%s already processed",
                        item.chat_id, item.message_id, recipient_username
                    )
                    continue

                # 2. Check if recipient is still enabled
                rec_db = db.query(Recipient).filter(
                    Recipient.username == recipient_username,
                    Recipient.enabled == True
                ).first()

                if not rec_db:
                    logger.info("Recipient %s is disabled or deleted, skipping.", recipient_username)
                    continue

                # 3. Perform MTProto Native Forward with Retry & FloodWait Handling
                success = False
                error_msg = None
                status = "FAILED"

                for attempt in range(1, settings.MAX_RETRY_ATTEMPTS + 1):
                    try:
                        if not telegram_service.client or not telegram_service.client.is_connected():
                            logger.warning("Telegram client disconnected. Attempting reconnect...")
                            await telegram_service.connect_and_start()

                        # Native MTProto forward preserving media, voice, video, captions, sender metadata
                        await telegram_service.client.forward_messages(
                            entity=recipient_username,
                            messages=item.message_id,
                            from_peer=item.chat_id
                        )

                        success = True
                        status = "FORWARDED"
                        logger.info(
                            "Successfully forwarded msg #%s from '%s' to %s",
                            item.message_id, item.group_title, recipient_username
                        )
                        break

                    except FloodWaitError as e:
                        logger.warning("FloodWait encountered! Sleeping for %s seconds...", e.seconds)
                        status = "FLOOD_WAIT"
                        error_msg = f"FloodWait: {e.seconds}s"
                        # Respect Telegram mandatory wait
                        await asyncio.sleep(e.seconds + 1)
                        # retry this attempt
                        continue

                    except ChatForwardsRestrictedError:
                        logger.warning(
                            "Content protection active on chat %s. Forwarding forbidden by Telegram.",
                            item.chat_id
                        )
                        status = "PROTECTED_CONTENT"
                        error_msg = "Content protection enabled in group. Cannot forward."
                        break

                    except (UsernameNotOccupiedError, UsernameInvalidError, PeerIdInvalidError) as e:
                        status = "INVALID_RECIPIENT"
                        error_msg = f"Invalid recipient username: {str(e)}"
                        logger.error("Recipient error for %s: %s", recipient_username, str(e))
                        break

                    except UserIsBlockedError:
                        status = "BLOCKED"
                        error_msg = "User has blocked incoming messages."
                        break

                    except RPCError as e:
                        error_msg = f"RPC Error (attempt {attempt}): {str(e)}"
                        logger.error("RPC Error forwarding to %s: %s", recipient_username, str(e))
                        if attempt < settings.MAX_RETRY_ATTEMPTS:
                            await asyncio.sleep(attempt * 2)  # Exponential backoff
                    except Exception as e:
                        error_msg = f"Unknown Error (attempt {attempt}): {str(e)}"
                        logger.error("Error forwarding to %s: %s", recipient_username, str(e))
                        if attempt < settings.MAX_RETRY_ATTEMPTS:
                            await asyncio.sleep(attempt * 2)

                # 4. Save Deduplication Record
                processed_record = ProcessedMessage(
                    chat_id=item.chat_id,
                    message_id=item.message_id,
                    recipient=recipient_username,
                    status=status
                )
                db.add(processed_record)

                # 5. Log Result in Database
                log_entry = ForwardLog(
                    group_title=item.group_title,
                    chat_id=item.chat_id,
                    message_id=item.message_id,
                    sender_name=item.sender_name,
                    matched_keywords=",".join(item.matched_keywords),
                    recipient=recipient_username,
                    status=status,
                    error_message=error_msg
                )
                db.add(log_entry)

                # 6. Update Counters
                if success:
                    rec_db.forwarded_count += 1
                    rec_db.last_forward_at = datetime.utcnow()

                    group_db = db.query(MonitoredGroup).filter(MonitoredGroup.chat_id == item.chat_id).first()
                    if group_db:
                        group_db.forwarded_count += 1

                db.commit()

                # 7. Rate Limiting Pause between recipients
                if forward_delay > 0:
                    await asyncio.sleep(forward_delay)

        finally:
            db.close()

    def stop(self):
        self.is_running = False


forward_worker = ForwardWorker()
