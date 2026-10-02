import os
import json
import asyncio
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat, User
from telethon.errors import (
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    PhoneNumberInvalidError,
    PasswordHashInvalidError,
    FloodWaitError
)

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models.keyword import Keyword
from backend.app.models.recipient import Recipient
from backend.app.models.group import MonitoredGroup
from backend.app.models.log import ForwardLog
from backend.app.models.settings import SystemSetting
from backend.app.services.keyword_matcher import keyword_matcher
from backend.app.services.queue_manager import queue_manager, QueueItem

logger = logging.getLogger("telegram_userbot")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))


class TelegramService:
    def __init__(self):
        self.api_id = settings.TELEGRAM_API_ID
        self.api_hash = settings.TELEGRAM_API_HASH
        self.session_path = os.path.join("./data", settings.TELEGRAM_SESSION_NAME)
        
        self.client: Optional[TelegramClient] = None
        self.is_running = False
        self.status = "STOPPED"  # RUNNING, STOPPED, STARTING, STOPPING, RECONNECTING, ERROR
        self.phone_code_hash: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.last_error: Optional[str] = None
        self.me_info: Optional[Dict[str, Any]] = None
        self._login_state_file = os.path.join("./data", "telegram_login_state.json")

    def _save_login_state(self, phone: str, phone_code_hash: str):
        """Persists pending phone and phone_code_hash to DB and local storage to survive restarts."""
        self.phone_number = phone
        self.phone_code_hash = phone_code_hash

        # 1. Local JSON file
        try:
            os.makedirs("./data", exist_ok=True)
            with open(self._login_state_file, "w", encoding="utf-8") as f:
                json.dump({
                    "phone": phone,
                    "phone_code_hash": phone_code_hash,
                    "timestamp": datetime.utcnow().isoformat()
                }, f)
        except Exception as e:
            logger.warning("Could not write telegram_login_state.json: %s", e)

        # 2. SQLite DB SystemSetting table
        try:
            db = SessionLocal()
            try:
                p_set = db.query(SystemSetting).filter(SystemSetting.key == "TELEGRAM_PENDING_PHONE").first()
                if not p_set:
                    db.add(SystemSetting(key="TELEGRAM_PENDING_PHONE", value=phone, description="Pending Phone"))
                else:
                    p_set.value = phone

                h_set = db.query(SystemSetting).filter(SystemSetting.key == "TELEGRAM_PENDING_HASH").first()
                if not h_set:
                    db.add(SystemSetting(key="TELEGRAM_PENDING_HASH", value=phone_code_hash, description="Pending Code Hash"))
                else:
                    h_set.value = phone_code_hash

                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning("Could not persist login state to DB: %s", e)

    def _load_login_state(self) -> tuple[Optional[str], Optional[str]]:
        """Loads pending phone and phone_code_hash from DB or local file if in-memory is empty."""
        phone = self.phone_number
        phone_code_hash = self.phone_code_hash

        if not phone or not phone_code_hash:
            try:
                db = SessionLocal()
                try:
                    p_set = db.query(SystemSetting).filter(SystemSetting.key == "TELEGRAM_PENDING_PHONE").first()
                    h_set = db.query(SystemSetting).filter(SystemSetting.key == "TELEGRAM_PENDING_HASH").first()
                    if p_set and p_set.value:
                        phone = p_set.value
                    if h_set and h_set.value:
                        phone_code_hash = h_set.value
                finally:
                    db.close()
            except Exception as e:
                logger.warning("Could not load login state from DB: %s", e)

        if not phone or not phone_code_hash:
            if os.path.exists(self._login_state_file):
                try:
                    with open(self._login_state_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        phone = phone or data.get("phone")
                        phone_code_hash = phone_code_hash or data.get("phone_code_hash")
                except Exception as e:
                    logger.warning("Could not read telegram_login_state.json: %s", e)

        self.phone_number = phone
        self.phone_code_hash = phone_code_hash
        return phone, phone_code_hash

    def _clear_login_state(self):
        """Cleans up temporary pairing credentials after successful authentication."""
        self.phone_code_hash = None
        if os.path.exists(self._login_state_file):
            try:
                os.remove(self._login_state_file)
            except Exception:
                pass
        try:
            db = SessionLocal()
            try:
                db.query(SystemSetting).filter(
                    SystemSetting.key.in_(["TELEGRAM_PENDING_PHONE", "TELEGRAM_PENDING_HASH"])
                ).delete(synchronize_session=False)
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

    async def ensure_connected(self):
        """Ensures TelegramClient is initialized and connected as a singleton."""
        await self.initialize()
        if not self.client.is_connected():
            await self.client.connect()

    async def initialize(self):
        """Initializes the Telethon MTProto Client."""
        if not self.client:
            self.client = TelegramClient(self.session_path, self.api_id, self.api_hash)
            self._register_handlers()

    def _register_handlers(self):
        """Registers the Telethon group message event handler."""
        @self.client.on(events.NewMessage())
        async def handle_new_message(event):
            if not self.is_running:
                return

            try:
                msg = event.message
                if not msg:
                    return

                # 1. Message Metadata & Diagnostics
                chat_id = event.chat_id
                is_outgoing = bool(event.out)
                message_id = event.id
                raw_text = event.raw_text or getattr(msg, "message", "") or ""
                text_preview = (raw_text[:80] + "...") if len(raw_text) > 80 else raw_text

                # 2. Sender Details
                sender = await event.get_sender()
                sender_id = getattr(sender, "id", None) or getattr(msg, "sender_id", None)
                sender_username = f"@{sender.username}" if sender and getattr(sender, "username", None) else None
                sender_name = getattr(sender, "first_name", "") or ""
                if sender and getattr(sender, "last_name", None):
                    sender_name += f" {sender.last_name}"
                if not sender_name:
                    sender_name = sender_username or ("حسابي (Self)" if is_outgoing else "عضو في المجموعة")

                # 3. Chat Details
                chat = await event.get_chat()
                group_title = getattr(chat, "title", None) or f"Group_{chat_id}"
                is_group = bool(event.is_group)

                # Diagnostic Logging
                logger.info(
                    "\n========================================\n"
                    "[Telegram Event Received]\n"
                    "  chat_id: %s\n"
                    "  chat_title: \"%s\"\n"
                    "  sender_id: %s\n"
                    "  sender_username: %s\n"
                    "  is_outgoing: %s\n"
                    "  message_id: %s\n"
                    "  text preview: \"%s\"\n"
                    "  is_group: %s\n"
                    "========================================",
                    chat_id, group_title, sender_id, sender_username, is_outgoing, message_id, text_preview, is_group
                )

                # 4. Verify Message Source is GROUP only
                if not is_group:
                    logger.debug("Skipping non-group message from chat %s", chat_id)
                    return

                if not raw_text.strip():
                    return

                # 5. Check Monitoring Mode (ALL vs SELECTED)
                db = SessionLocal()
                try:
                    mode_setting = db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first()
                    monitor_mode = mode_setting.value if mode_setting else settings.MONITOR_MODE

                    # Auto-discover / register group in database
                    group = db.query(MonitoredGroup).filter(MonitoredGroup.chat_id == chat_id).first()
                    if not group:
                        group = MonitoredGroup(
                            chat_id=chat_id,
                            title=group_title,
                            username=getattr(chat, "username", None),
                            members_count=getattr(chat, "participants_count", None),
                            is_monitored=True,
                            last_activity_at=datetime.utcnow()
                        )
                        db.add(group)
                        db.commit()
                    else:
                        group.last_activity_at = datetime.utcnow()
                        if group.title != group_title:
                            group.title = group_title
                        db.commit()

                    if monitor_mode == "SELECTED" and not group.is_monitored:
                        logger.info("Skipped unmonitored group (Mode: SELECTED): %s", group_title)
                        return

                    # 6. Fetch Active Keywords
                    active_kw_records = db.query(Keyword).filter(Keyword.enabled == True).all()
                    active_keywords = [k.keyword for k in active_kw_records]

                    if not active_keywords:
                        return

                    # 7. Apply Arabic Normalization & Keyword Matcher (Threshold = 1)
                    is_match, matched_kws, normalized = keyword_matcher.match_message(raw_text, active_keywords)

                    logger.info(
                        "[Keyword Matcher Evaluation] Group: \"%s\", Sender: \"%s\", Matched: %s, Status: %s",
                        group_title, sender_name, matched_kws, "MATCH -> QUEUED" if is_match else "NO MATCH"
                    )

                    if not is_match or not matched_kws:
                        return

                    # Update Keyword Match Counters
                    for kw_str in matched_kws:
                        kw_record = next((k for k in active_kw_records if k.keyword == kw_str), None)
                        if kw_record:
                            kw_record.matched_count += 1
                    
                    # Update Group Match Counter
                    group.matched_count += 1
                    db.commit()

                    # 8. Fetch Active Target Recipients
                    active_recipients = db.query(Recipient).filter(Recipient.enabled == True).all()
                    recipient_usernames = [r.username for r in active_recipients]

                    if not recipient_usernames:
                        logger.warning("Message matched keywords %s but no active recipients configured", matched_kws)
                        return

                    # 9. Push to Forward Queue (Decoupled from Event Listener)
                    queue_item = QueueItem(
                        chat_id=chat_id,
                        message_id=event.id,
                        group_title=group_title,
                        sender_name=sender_name,
                        matched_keywords=matched_kws,
                        recipients=recipient_usernames,
                        raw_text=raw_text[:200]
                    )

                    # Log initial Queue event
                    log_entry = ForwardLog(
                        group_title=group_title,
                        chat_id=chat_id,
                        message_id=event.id,
                        sender_name=sender_name,
                        matched_keywords=",".join(matched_kws),
                        recipient=None,
                        status="QUEUED",
                        error_message=None
                    )
                    db.add(log_entry)
                    db.commit()

                    await queue_manager.put(queue_item)
                    logger.info("Enqueued message #%s from '%s' matching %s", event.id, group_title, matched_kws)

                finally:
                    db.close()

            except Exception as e:
                logger.error("Error in Telegram event listener: %s", str(e), exc_info=True)

    async def connect_and_start(self) -> Dict[str, Any]:
        """Starts client connection and resumes session if available."""
        await self.initialize()
        self.status = "STARTING"
        try:
            await self.client.connect()
            if await self.client.is_user_authorized():
                me = await self.client.get_me()
                self.me_info = {
                    "id": me.id,
                    "first_name": me.first_name,
                    "last_name": me.last_name,
                    "username": me.username,
                    "phone": me.phone
                }
                self.is_running = True
                self.status = "RUNNING"
                self.last_error = None
                logger.info("Telegram Userbot connected successfully as @%s", me.username or me.first_name)
                return {"success": True, "status": "RUNNING", "user": self.me_info}
            else:
                self.status = "STOPPED"
                self.is_running = False
                return {"success": False, "status": "NEEDS_AUTH", "message": "Phone authentication required."}
        except Exception as e:
            self.status = "ERROR"
            self.last_error = str(e)
            self.is_running = False
            logger.error("Failed to connect Telegram client: %s", str(e))
            return {"success": False, "status": "ERROR", "error": str(e)}

    async def send_code_request(self, phone: str) -> Dict[str, Any]:
        """Requests login SMS / Telegram Code for phone and persists the code hash."""
        phone = phone.strip()
        await self.ensure_connected()

        try:
            res = await self.client.send_code_request(phone)
            self._save_login_state(phone, res.phone_code_hash)
            return {
                "success": True,
                "status": "code_sent",
                "message": "تم إرسال رمز تسجيل الدخول بنجاح عبر تيليجرام.",
                "phone": phone,
                "phone_code_hash": res.phone_code_hash,
                "is_code_via_app": getattr(res, "is_code_via_app", True)
            }
        except FloodWaitError as e:
            msg = f"تم حظرك مؤقتاً لتكرار المحاولات (FloodWait): يرجى الانتظار {e.seconds} ثانية."
            logger.warning(msg)
            return {"success": False, "status": "flood_wait", "error": msg, "wait_seconds": e.seconds}
        except PhoneNumberInvalidError:
            return {"success": False, "status": "error", "error": "رقم الهاتف غير صالح في تيليجرام. تأكد من كتابة المفتاح الدولي كاملاً (مثال: +967xxxxxxxxx)"}
        except Exception as e:
            logger.error("Failed to send telegram code: %s", e)
            return {"success": False, "status": "error", "error": str(e)}

    async def sign_in_with_code(
        self,
        code: str,
        password: Optional[str] = None,
        phone: Optional[str] = None,
        phone_code_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Completes sign-in with received code, loading persisted hash if needed.
        Catches SessionPasswordNeededError and returns {"status": "2fa_required", "message": "Password needed"}.
        """
        code = str(code).strip()
        await self.ensure_connected()

        saved_phone, saved_hash = self._load_login_state()
        phone = phone or saved_phone
        phone_code_hash = phone_code_hash or saved_hash

        if not phone or not phone_code_hash:
            return {
                "success": False,
                "status": "error",
                "error": "لم يتم العثور على رمز التحقق المسبق (Hash). يرجى طلب إرسال الكود أولاً."
            }

        try:
            await self.client.sign_in(phone, code, phone_code_hash=phone_code_hash)
            me = await self.client.get_me()
            self.me_info = {
                "id": me.id,
                "first_name": me.first_name,
                "last_name": me.last_name,
                "username": me.username,
                "phone": me.phone
            }
            self.is_running = True
            self.status = "RUNNING"
            self.last_error = None
            self._clear_login_state()
            logger.info("Telegram signed in successfully as @%s", me.username or me.first_name)
            return {
                "success": True,
                "status": "connected",
                "message": "تم تسجيل الدخول وربط الحساب بنجاح",
                "user": self.me_info
            }
        except SessionPasswordNeededError:
            if password:
                return await self.sign_in_with_password(password)
            logger.info("2FA password required for Telegram account %s", phone)
            return {
                "success": False,
                "status": "2fa_required",
                "requires_2fa": True,
                "message": "Password needed"
            }
        except PhoneCodeInvalidError:
            return {"success": False, "status": "invalid_code", "error": "رمز التحقق المدخل غير صحيح (Invalid Code)"}
        except PhoneCodeExpiredError:
            return {"success": False, "status": "expired_code", "error": "رمز التحقق منتهي الصلاحية. يرجى طلب رمز جديد."}
        except FloodWaitError as e:
            return {"success": False, "status": "flood_wait", "error": f"تم حظرك مؤقتاً (FloodWait): يرجى الانتظار {e.seconds} ثانية."}
        except Exception as e:
            # Fallback check for 2FA in exception name/message
            if "SessionPasswordNeededError" in type(e).__name__ or "2FA" in str(e):
                return {
                    "success": False,
                    "status": "2fa_required",
                    "requires_2fa": True,
                    "message": "Password needed"
                }
            logger.error("Failed to verify code: %s", e)
            return {"success": False, "status": "error", "error": str(e)}

    async def sign_in_with_password(self, password: str) -> Dict[str, Any]:
        """Completes 2FA Cloud Password authentication."""
        await self.ensure_connected()
        password = str(password).strip()

        try:
            await self.client.sign_in(password=password)
            me = await self.client.get_me()
            self.me_info = {
                "id": me.id,
                "first_name": me.first_name,
                "last_name": me.last_name,
                "username": me.username,
                "phone": me.phone
            }
            self.is_running = True
            self.status = "RUNNING"
            self.last_error = None
            self._clear_login_state()
            logger.info("2FA authentication successful for @%s", me.username or me.first_name)
            return {
                "success": True,
                "status": "connected",
                "message": "تم التحقق من كلمة مرور 2FA بنجاح وربط الحساب",
                "user": self.me_info
            }
        except PasswordHashInvalidError:
            return {"success": False, "status": "invalid_password", "error": "كلمة مرور التحقق بخطوتين (2FA) غير صحيحة."}
        except FloodWaitError as e:
            return {"success": False, "status": "flood_wait", "error": f"تم حظرك مؤقتاً (FloodWait): يرجى الانتظار {e.seconds} ثانية."}
        except Exception as e:
            logger.error("Failed to verify 2FA password: %s", e)
            return {"success": False, "status": "error", "error": str(e)}

    async def stop(self):
        """Stops monitoring and message processing without clearing credentials/settings."""
        self.is_running = False
        self.status = "STOPPED"
        logger.info("Telegram monitoring stopped by user.")
        return {"success": True, "status": "STOPPED"}

    async def restart(self):
        """Restarts connection cleanly."""
        self.status = "RECONNECTING"
        self.is_running = False
        try:
            if self.client and self.client.is_connected():
                await self.client.disconnect()
            await asyncio.sleep(1)
            return await self.connect_and_start()
        except Exception as e:
            self.status = "ERROR"
            self.last_error = str(e)
            return {"success": False, "status": "ERROR", "error": str(e)}

    async def fetch_joined_groups(self) -> List[Dict[str, Any]]:
        """Syncs all joined Telegram groups to database."""
        if not self.client or not self.client.is_connected():
            return []

        groups = []
        db = SessionLocal()
        try:
            async for dialog in self.client.iter_dialogs():
                if dialog.is_group:
                    chat_id = dialog.id
                    title = dialog.title
                    existing = db.query(MonitoredGroup).filter(MonitoredGroup.chat_id == chat_id).first()
                    if not existing:
                        existing = MonitoredGroup(
                            chat_id=chat_id,
                            title=title,
                            is_monitored=True,
                            last_activity_at=datetime.utcnow()
                        )
                        db.add(existing)
                    else:
                        existing.title = title
                    groups.append({
                        "chat_id": chat_id,
                        "title": title,
                        "is_monitored": existing.is_monitored
                    })
            db.commit()
            return groups
        finally:
            db.close()


telegram_service = TelegramService()
