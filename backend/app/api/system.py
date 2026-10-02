import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.config import settings
from backend.app.models.settings import SystemSetting
from backend.app.schemas.schemas import (
    SystemStatusResponse,
    TelegramPhoneRequest,
    TelegramCodeRequest,
    TelegramPasswordRequest,
    MessageTestRequest,
    MessageTestResponse
)
from backend.app.services.telegram_client import telegram_service
from backend.app.services.queue_manager import queue_manager
from backend.app.services.keyword_matcher import keyword_matcher
from backend.app.services.arabic_normalizer import arabic_normalizer
from backend.app.models.keyword import Keyword

router = APIRouter(prefix="/api/system", tags=["System & Controls"])


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    mode_setting = db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first()
    monitor_mode = mode_setting.value if mode_setting else settings.MONITOR_MODE

    session_file = os.path.join("./data", f"{settings.TELEGRAM_SESSION_NAME}.session")
    session_exists = os.path.exists(session_file)

    is_connected = bool(telegram_service.client and telegram_service.client.is_connected() and telegram_service.is_running)

    return SystemStatusResponse(
        status=telegram_service.status,
        is_connected=is_connected,
        session_exists=session_exists,
        account=telegram_service.me_info,
        monitor_mode=monitor_mode,
        matching_rule="يكفي وجود كلمة مفتاحية واحدة فقط",
        keyword_threshold=1,
        queue_size=queue_manager.qsize(),
        last_error=telegram_service.last_error
    )


@router.post("/start")
async def start_system(user: str = Depends(get_current_user)):
    res = await telegram_service.connect_and_start()
    return res


@router.post("/stop")
async def stop_system(user: str = Depends(get_current_user)):
    res = await telegram_service.stop()
    return res


@router.post("/restart")
async def restart_system(user: str = Depends(get_current_user)):
    res = await telegram_service.restart()
    return res


# Telegram Auth endpoints (No strict auth barrier so connecting Telegram works seamlessly)
@router.post("/telegram/request-code")
@router.post("/telegram/send-code")
async def request_telegram_code(payload: TelegramPhoneRequest):
    res = await telegram_service.send_code_request(payload.phone)
    return res


@router.post("/telegram/verify-code")
@router.post("/telegram/verify")
@router.post("/telegram/login")
async def verify_telegram_code(payload: TelegramCodeRequest):
    res = await telegram_service.sign_in_with_code(payload.code, payload.password)
    return res


@router.post("/telegram/verify-2fa")
async def verify_telegram_2fa(payload: TelegramPasswordRequest):
    res = await telegram_service.sign_in_with_password(payload.password)
    return res


# Live Sandbox Message Tester
@router.post("/test-message", response_model=MessageTestResponse)
async def test_message(
    payload: MessageTestRequest,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    active_kws = [k.keyword for k in db.query(Keyword).filter(Keyword.enabled == True).all()]
    is_match, matched, normalized = keyword_matcher.match_message(payload.text, active_kws)
    tokens = arabic_normalizer.tokenize(normalized)

    explanation = (
        f"تمت المطابقة بنجاح لاحتواء الرسالة على الكلمات: {', '.join(matched)}"
        if is_match else
        "لم يتم العثور على أي كلمة مفتاحية مفعلة في نص الرسالة."
    )

    return MessageTestResponse(
        raw_text=payload.text,
        normalized_text=normalized,
        tokens=tokens,
        is_match=is_match,
        matched_keywords=matched,
        matching_rule="يكفي وجود كلمة مفتاحية واحدة فقط",
        explanation=explanation
    )
