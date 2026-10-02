from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.config import settings
from backend.app.models.settings import SystemSetting
from backend.app.schemas.schemas import SettingsUpdate
from backend.app.services.telegram_client import telegram_service

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("")
async def get_settings(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    delay_s = db.query(SystemSetting).filter(SystemSetting.key == "FORWARD_DELAY").first()
    mode_s = db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first()
    tz_s = db.query(SystemSetting).filter(SystemSetting.key == "TIMEZONE").first()
    lvl_s = db.query(SystemSetting).filter(SystemSetting.key == "LOG_LEVEL").first()
    retries_s = db.query(SystemSetting).filter(SystemSetting.key == "MAX_RETRY_ATTEMPTS").first()

    return {
        "telegram": {
            "api_id": settings.TELEGRAM_API_ID,  # Public App ID only
            "phone": settings.TELEGRAM_PHONE or (telegram_service.me_info.get("phone") if telegram_service.me_info else None),
            "is_connected": bool(telegram_service.client and telegram_service.client.is_connected()),
            "status": telegram_service.status,
            "session_name": settings.TELEGRAM_SESSION_NAME
        },
        "filtering": {
            "matching_rule": "يكفي وجود كلمة مفتاحية واحدة فقط (ANY Keyword)",
            "keyword_threshold": 1,
            "threshold_editable": False,
            "allowed_chat_types": ["Groups (مجموعات فقط)"],
            "ignored_types": ["Private Chats", "Channels", "Bots", "Saved Messages"]
        },
        "forwarding": {
            "forward_delay": float(delay_s.value) if delay_s else settings.FORWARD_DELAY,
            "retry_attempts": int(retries_s.value) if retries_s else settings.MAX_RETRY_ATTEMPTS,
            "forward_method": "MTProto Native Message Forward (يحافظ على الميديا والمعلومات)"
        },
        "monitoring": {
            "monitor_mode": mode_s.value if mode_s else settings.MONITOR_MODE
        },
        "system": {
            "timezone": tz_s.value if tz_s else settings.TIMEZONE,
            "log_level": lvl_s.value if lvl_s else settings.LOG_LEVEL,
            "dashboard_username": settings.DASHBOARD_USERNAME
        }
    }


@router.put("")
async def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    if payload.forward_delay is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "FORWARD_DELAY").first()
        if not s:
            s = SystemSetting(key="FORWARD_DELAY", value=str(payload.forward_delay))
            db.add(s)
        else:
            s.value = str(payload.forward_delay)

    if payload.retry_attempts is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "MAX_RETRY_ATTEMPTS").first()
        if not s:
            s = SystemSetting(key="MAX_RETRY_ATTEMPTS", value=str(payload.retry_attempts))
            db.add(s)
        else:
            s.value = str(payload.retry_attempts)

    if payload.monitor_mode is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first()
        if not s:
            s = SystemSetting(key="MONITOR_MODE", value=payload.monitor_mode)
            db.add(s)
        else:
            s.value = payload.monitor_mode

    if payload.timezone is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "TIMEZONE").first()
        if not s:
            s = SystemSetting(key="TIMEZONE", value=payload.timezone)
            db.add(s)
        else:
            s.value = payload.timezone

    if payload.log_level is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "LOG_LEVEL").first()
        if not s:
            s = SystemSetting(key="LOG_LEVEL", value=payload.log_level)
            db.add(s)
        else:
            s.value = payload.log_level

    db.commit()
    telegram_service.refresh_cache()
    return {"success": True, "message": "تم تحديث الإعدادات بنجاح"}
