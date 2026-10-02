import os
import json
import shutil
import asyncio
import logging
from typing import Optional, List, Dict, Any, Set
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
from backend.app.models.message import ProcessedMessage
from backend.app.models.settings import SystemSetting
from backend.app.services.keyword_matcher import keyword_matcher

logger = logging.getLogger("telegram_userbot")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))


class TelegramService:
    def __init__(self):
        self.api_id = settings.TELEGRAM_API_ID
        self.api_hash = settings.TELEGRAM_API_HASH
        
        # Ensure persistent data directory exists
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        self.session_path = os.path.join(settings.DATA_DIR, settings.TELEGRAM_SESSION_NAME)
        
        # Legacy session migration if needed
        self._check_legacy_session()

        self.client: Optional[TelegramClient] = None
        self.is_running = False
        self.should_run = True  # Desired state for 24/7 auto-reconnect
        self.status = "STOPPED"  # RUNNING, STOPPED, STARTING, RECONNECTING, ERROR
        self.phone_code_hash: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.last_error: Optional[str] = None
        self.me_info: Optional[Dict[str, Any]] = None
        self._login_state_file = os.path.join(settings.DATA_DIR, "telegram_login_state.json")
        self._reconnect_task: Optional[asyncio.Task] = None

        # Zero-Latency In-Memory Cache (Microseconds matching without DB blocking)
        self.cached_keywords: List[str] = []
        self.cached_recipients: List[str] = []
        self.cached_monitored_groups: Dict[int, bool] = {}
        self.cached_monitor_mode: str = "ALL"
        self.processed_ids: Set[str] = set()

    def _check_legacy_session(self):
        """Migrates legacy session filename to userbot.session if found."""
        try:
            target_file = f"{self.session_path}.session"
            legacy_file = os.path.join(settings.DATA_DIR, "telegram_userbot.session")
            if not os.path.exists(target_file) and os.path.exists(legacy_file):
                logger.info("Migrating legacy session %s -> %s", legacy_file, target_file)
                shutil.copy2(legacy_file, target_file)
        except Exception as e:
            logger.warning("Session migration notice: %s", e)

    def _get_system_setting(self, key: str, default: str = "") -> str:
        try:
            db = SessionLocal()
            try:
                item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
                return item.value if item else default
            finally:
                db.close()
        except Exception:
            return default

    def _set_system_setting(self, key: str, value: str, description: str = ""):
        try:
            db = SessionLocal()
            try:
                item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
                if not item:
                    db.add(SystemSetting(key=key, value=value, description=description))
                else:
                    item.value = value
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning("Could not set SystemSetting %s: %s", key, e)

    def _save_login_state(self, phone: str, phone_code_hash: str):
        """Persists pending phone and phone_code_hash to DB and local storage to survive restarts."""
        self.phone_number = phone
        self.phone_code_hash = phone_code_hash

        # 1. Local JSON file
        try:
            with open(self._login_state_file, "w", encoding="utf-8") as f:
                json.dump({
                    "phone": phone,
                    "phone_code_hash": phone_code_hash,
                    "timestamp": datetime.utcnow().isoformat()
                }, f)
        except Exception as e:
            logger.warning("Could not write telegram_login_state.json: %s", e)

        # 2. SQLite DB SystemSetting table
        self._set_system_setting("TELEGRAM_PENDING_PHONE", phone, "Pending Telegram Phone")
        self._set_system_setting("TELEGRAM_PENDING_HASH", phone_code_hash, "Pending Telegram Code Hash")

    def _load_login_state(self) -> tuple[Optional[str], Optional[str]]:
        """Loads pending phone and phone_code_hash from DB or local file if in-memory is empty."""
        phone = self.phone_number
        phone_code_hash = self.phone_code_hash

        if not phone or not phone_code_hash:
            db_phone = self._get_system_setting("TELEGRAM_PENDING_PHONE", "")
            db_hash = self._get_system_setting("TELEGRAM_PENDING_HASH", "")
            if db_phone:
                phone = db_phone
            if db_hash:
                phone_code_hash = db_hash

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

    def refresh_cache(self):
        """
        Loads active keywords, enabled recipients, monitored groups, and settings into RAM.
        Ensures zero-latency routing with ZERO database overhead during message arrival.
        """
        try:
            db = SessionLocal()
            try:
                # 1. Keywords
                kws = db.query(Keyword).filter(Keyword.enabled == True).all()
                self.cached_keywords = [k.keyword for k in kws]

                # 2. Recipients
                recs = db.query(Recipient).filter(Recipient.enabled == True).all()
                self.cached_recipients = [r.username for r in recs]

                # 3. Monitored groups map
                groups = db.query(MonitoredGroup).all()
                self.cached_monitored_groups = {g.chat_id: g.is_monitored for g in groups}

                # 4. Settings
                mode_set = db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first()
                self.cached_monitor_mode = mode_set.value if mode_set else settings.MONITOR_MODE

                # 5. Populate initial deduplication cache from processed messages
                if len(self.processed_ids) == 0:
                    recent_msgs = db.query(ProcessedMessage).order_by(ProcessedMessage.id.desc()).limit(1000).all()
                    for m in recent_msgs:
                        self.processed_ids.add(f"{m.chat_id}:{m.message_id}:{m.recipient}")

                logger.info(
                    "[Cache Refreshed] Active Keywords: %d | Active Recipients: %d | Mode: %s",
                    len(self.cached_keywords), len(self.cached_recipients), self.cached_monitor_mode
                )
            finally:
                db.close()
        except Exception as e:
            logger.error("Error refreshing in-memory cache: %s", e)

    async def ensure_connected(self):
        """Ensures TelegramClient is initialized and connected as a singleton."""
        await self.initialize()
        if not self.client.is_connected():
            await self.client.connect()

    async def initialize(self):
        """Initializes the Telethon MTProto Client with the persistent session path."""
        if not self.client:
            logger.info("Initializing Telethon client with persistent session at: %s", self.session_path)
            self.client = TelegramClient(self.session_path, self.api_id, self.api_hash)
            self._register_handlers()
            self.refresh_cache()

    def _register_handlers(self):
        """Registers the Telethon group message event handler for zero-latency direct routing."""
        @self.client.on(events.NewMessage())
        async def handle_new_message(event):
            # 1. State check
            if not self.is_running:
                return

            try:
                # 2. Must be a group message with text
                if not event.is_group:
                    return

                msg = event.message
                if not msg:
                    return

                raw_text = event.raw_text or getattr(msg, "message", "") or ""
                if not raw_text.strip():
                    return

                chat_id = event.chat_id
                message_id = event.id

                # 3. Fast Monitor Mode Check in RAM (No DB overhead)
                if self.cached_monitor_mode == "SELECTED":
                    is_monitored = self.cached_monitored_groups.get(chat_id, True)
                    if not is_monitored:
                        return

                # 4. Instant Arabic Keyword Matching in RAM (Microseconds, No DB blocking)
                if not self.cached_keywords:
                    return

                is_match, matched_kws, _ = keyword_matcher.match_message(raw_text, self.cached_keywords)
                if not is_match or not matched_kws:
                    return

                if not self.cached_recipients:
                    logger.warning("[Telegram] Message matched keywords %s but no active recipients configured", matched_kws)
                    return

                # 5. Extract Sender & Chat Details
                sender = await event.get_sender()
                sender_name = getattr(sender, "first_name", "") or ""
                if sender and getattr(sender, "last_name", None):
                    sender_name += f" {sender.last_name}"
                if not sender_name:
                    sender_name = f"@{sender.username}" if sender and getattr(sender, "username", None) else "عضو في المجموعة"

                chat = await event.get_chat()
                group_title = getattr(chat, "title", None) or f"Group_{chat_id}"

                logger.info(
                    "[MATCH FOUND] Group: '%s' | Sender: '%s' | Matched: %s -> Forwarding immediately to %d recipients",
                    group_title, sender_name, matched_kws, len(self.cached_recipients)
                )

                # 6. Execute Zero-Latency Forwarding Concurrently
                asyncio.create_task(
                    self._dispatch_instant_forwards(
                        chat_id=chat_id,
                        message_id=message_id,
                        group_title=group_title,
                        sender_name=sender_name,
                        matched_kws=matched_kws,
                        raw_text=raw_text
                    )
                )

            except Exception as e:
                logger.error("Error in Telegram event listener: %s", str(e), exc_info=True)

    async def _dispatch_instant_forwards(
        self,
        chat_id: int,
        message_id: int,
        group_title: str,
        sender_name: str,
        matched_kws: List[str],
        raw_text: str
    ):
        """Forwards message directly to all target recipients concurrently with zero delay."""
        recipients_copy = list(self.cached_recipients)
        tasks = []
        for recipient in recipients_copy:
            tasks.append(
                self._forward_to_single_recipient(
                    chat_id, message_id, group_title, sender_name, matched_kws, recipient, raw_text
                )
            )
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _forward_to_single_recipient(
        self,
        chat_id: int,
        message_id: int,
        group_title: str,
        sender_name: str,
        matched_kws: List[str],
        recipient: str,
        raw_text: str
    ):
        """Forwards to a single recipient and logs result asynchronously in the background."""
        dedup_key = f"{chat_id}:{message_id}:{recipient}"
        if dedup_key in self.processed_ids:
            return
        self.processed_ids.add(dedup_key)
        if len(self.processed_ids) > 20000:
            self.processed_ids.pop()

        success = False
        error_msg = None
        status = "FAILED"

        try:
            if not self.client or not self.client.is_connected():
                await self.client.connect()

            # Native MTProto forward preserving media, captions, and sender info
            await self.client.forward_messages(
                entity=recipient,
                messages=message_id,
                from_peer=chat_id
            )
            success = True
            status = "FORWARDED"
            logger.info(">> [Zero-Latency Forward] Successfully forwarded msg #%s to %s", message_id, recipient)
        except FloodWaitError as e:
            error_msg = f"FloodWait: {e.seconds}s"
            status = "FLOOD_WAIT"
            logger.warning("[FloodWait] Wait %d seconds for recipient %s", e.seconds, recipient)
        except Exception as e:
            error_msg = str(e)
            status = "FAILED"
            logger.error("[Forward Failed] Recipient %s: %s", recipient, e)

        # Async background DB record (Non-blocking)
        asyncio.create_task(
            self._record_forward_db(
                chat_id=chat_id,
                message_id=message_id,
                group_title=group_title,
                sender_name=sender_name,
                matched_kws=matched_kws,
                recipient=recipient,
                status=status,
                error_msg=error_msg,
                success=success
            )
        )

    async def _record_forward_db(
        self,
        chat_id: int,
        message_id: int,
        group_title: str,
        sender_name: str,
        matched_kws: List[str],
        recipient: str,
        status: str,
        error_msg: Optional[str],
        success: bool
    ):
        """Asynchronously updates database logs and counters without slowing down forwarding."""
        try:
            db = SessionLocal()
            try:
                # 1. Log entry
                log_entry = ForwardLog(
                    group_title=group_title,
                    chat_id=chat_id,
                    message_id=message_id,
                    sender_name=sender_name,
                    matched_keywords=",".join(matched_kws),
                    recipient=recipient,
                    status=status,
                    error_message=error_msg
                )
                db.add(log_entry)

                # 2. Processed Message deduplication record
                processed = ProcessedMessage(
                    chat_id=chat_id,
                    message_id=message_id,
                    recipient=recipient,
                    status=status
                )
                db.add(processed)

                # 3. Update recipient stats
                rec = db.query(Recipient).filter(Recipient.username == recipient).first()
                if rec and success:
                    rec.forwarded_count += 1
                    rec.last_forward_at = datetime.utcnow()

                # 4. Update group activity stats
                grp = db.query(MonitoredGroup).filter(MonitoredGroup.chat_id == chat_id).first()
                if grp:
                    grp.matched_count += 1
                    if success:
                        grp.forwarded_count += 1
                    grp.last_activity_at = datetime.utcnow()
                else:
                    new_grp = MonitoredGroup(
                        chat_id=chat_id,
                        title=group_title,
                        is_monitored=True,
                        matched_count=1,
                        forwarded_count=1 if success else 0,
                        last_activity_at=datetime.utcnow()
                    )
                    db.add(new_grp)

                # 5. Update keyword counters
                for kw_str in matched_kws:
                    kw_obj = db.query(Keyword).filter(Keyword.keyword == kw_str).first()
                    if kw_obj:
                        kw_obj.matched_count += 1

                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning("Could not commit async forward log: %s", e)

    async def connect_and_start(self) -> Dict[str, Any]:
        """
        Starts client connection and resumes session if available.
        Checks await client.is_user_authorized(). If authorized, starts listening immediately
        WITHOUT asking for phone number or verification code.
        """
        await self.initialize()
        self.refresh_cache()
        self.status = "STARTING"

        try:
            if not self.client.is_connected():
                await self.client.connect()

            # Persistent Session check
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
                self.should_run = True
                self.status = "RUNNING"
                self.last_error = None
                self._set_system_setting("SHOULD_RUN", "true", "24/7 desired running status")
                logger.info("[Telegram Userbot] Session verified & active as @%s. Forwarding RUNNING.", me.username or me.first_name)
                return {"success": True, "status": "RUNNING", "user": self.me_info}
            else:
                self.status = "STOPPED"
                self.is_running = False
                logger.info("[Telegram Userbot] No authorized session found. User authentication required.")
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
            self.should_run = True
            self.status = "RUNNING"
            self.last_error = None
            self._clear_login_state()
            self._set_system_setting("SHOULD_RUN", "true", "24/7 desired running status")
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
            self.should_run = True
            self.status = "RUNNING"
            self.last_error = None
            self._clear_login_state()
            self._set_system_setting("SHOULD_RUN", "true", "24/7 desired running status")
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
        """
        Stops monitoring and message processing WITHOUT deleting the session file.
        Preserves session authentication so clicking Start resumes immediately.
        """
        self.is_running = False
        self.should_run = False
        self.status = "STOPPED"
        self._set_system_setting("SHOULD_RUN", "false", "24/7 desired running status")
        logger.info("Telegram monitoring stopped by user. Session preserved safely.")
        return {"success": True, "status": "STOPPED", "message": "تم إيقاف المراقبة مؤقتاً مع الحفاظ على الجلسة"}

    async def restart(self):
        """Restarts connection cleanly without deleting session file."""
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

    async def start_auto_reconnect_loop(self):
        """
        Continuous 24/7 background task checking client connection every 60 seconds.
        If disconnected and mode was ACTIVE, automatically reconnects without manual intervention.
        """
        logger.info("[Auto-Reconnect Loop] 24/7 background keep-alive loop initiated.")
        # Load previous desired state from DB
        db_should_run = self._get_system_setting("SHOULD_RUN", "true")
        self.should_run = (db_should_run.lower() == "true")

        while True:
            try:
                await asyncio.sleep(60)

                if self.should_run:
                    if not self.client or not self.client.is_connected():
                        logger.warning("[Auto-Reconnect] Telegram client disconnected while in ACTIVE state. Reconnecting automatically...")
                        await self.connect_and_start()
                    else:
                        # Ping session to guarantee MTProto connection is healthy
                        try:
                            authorized = await self.client.is_user_authorized()
                            if not authorized:
                                logger.warning("[Auto-Reconnect] Session unauthorized. Setting status to STOPPED.")
                                self.status = "STOPPED"
                                self.is_running = False
                        except Exception as ping_err:
                            logger.warning("[Auto-Reconnect] Ping failed (%s). Reconnecting client...", ping_err)
                            try:
                                await self.client.disconnect()
                            except Exception:
                                pass
                            await self.connect_and_start()
            except asyncio.CancelledError:
                logger.info("[Auto-Reconnect Loop] Background task cancelled.")
                break
            except Exception as e:
                logger.error("[Auto-Reconnect Loop] Error in keep-alive check: %s", e)

    async def fetch_joined_groups(self) -> List[Dict[str, Any]]:
        """Syncs all joined Telegram groups to database."""
        if not self.client or not self.client.is_connected():
            return []

        groups = []
        db = SessionLocal()
        try:
            async for dialog in self.client.iter_dialogs():
                if dialog.is_group or dialog.is_channel:
                    chat = dialog.entity
                    chat_id = dialog.id
                    title = dialog.name or getattr(chat, "title", f"Group_{chat_id}")
                    username = getattr(chat, "username", None)
                    members_count = getattr(chat, "participants_count", None)

                    existing = db.query(MonitoredGroup).filter(MonitoredGroup.chat_id == chat_id).first()
                    if not existing:
                        existing = MonitoredGroup(
                            chat_id=chat_id,
                            title=title,
                            username=f"@{username}" if username else None,
                            members_count=members_count or 0,
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
            self.refresh_cache()
            return groups
        finally:
            db.close()


telegram_service = TelegramService()
