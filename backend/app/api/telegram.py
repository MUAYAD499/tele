import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any

from backend.app.schemas.schemas import (
    TelegramPhoneRequest,
    TelegramCodeRequest,
    TelegramPasswordRequest
)
from backend.app.services.telegram_client import telegram_service

logger = logging.getLogger("telegram_api")

router = APIRouter(prefix="/api/telegram", tags=["Telegram Pairing"])


@router.post("/send-code")
@router.post("/request-code")
async def send_code(payload: TelegramPhoneRequest):
    """
    Sends verification code to Telegram account.
    Wrapped in try...except to prevent HTTP 500 errors.
    """
    try:
        phone = (payload.phone or "").strip()
        if not phone:
            return JSONResponse(status_code=400, content={"success": False, "error": "رقم الهاتف مطلوب", "detail": "رقم الهاتف مطلوب"})

        res = await telegram_service.send_code_request(phone)
        if not res.get("success"):
            return JSONResponse(
                status_code=400 if res.get("status") != "flood_wait" else 429,
                content={
                    "success": False,
                    "status": res.get("status", "error"),
                    "error": res.get("error", "فشل إرسال رمز تسجيل الدخول"),
                    "detail": res.get("error", "فشل إرسال رمز تسجيل الدخول")
                }
            )
        return res
    except Exception as e:
        logger.error("Exception in send_code: %s", e, exc_info=True)
        return JSONResponse(status_code=400, content={"success": False, "status": "error", "error": str(e), "detail": str(e)})


@router.post("/verify")
@router.post("/verify-code")
async def verify_code(payload: TelegramCodeRequest):
    """
    Verifies code received from Telegram.
    If 2FA is needed, returns {"status": "2fa_required", "message": "Password needed"}.
    """
    if not payload.code or not payload.code.strip():
        raise HTTPException(status_code=400, detail="رمز التحقق مطلوب (Code is required)")

    res = await telegram_service.sign_in_with_code(
        code=payload.code.strip(),
        password=payload.password,
        phone=payload.phone,
        phone_code_hash=payload.phone_code_hash
    )

    if res.get("status") == "2fa_required" or res.get("requires_2fa"):
        return {
            "status": "2fa_required",
            "message": "Password needed",
            "requires_2fa": True,
            "success": False
        }

    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "رمز التحقق غير صحيح أو منتهي الصلاحية"))

    return res


@router.post("/verify-password")
@router.post("/verify-2fa")
async def verify_password(payload: TelegramPasswordRequest):
    """
    Verifies 2FA Cloud Password.
    """
    if not payload.password:
        raise HTTPException(status_code=400, detail="كلمة مرور التحقق بخطوتين مطلوبة")

    res = await telegram_service.sign_in_with_password(payload.password)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "كلمة مرور 2FA غير صحيحة"))

    return res


@router.get("/status")
async def get_status():
    """
    Gets current Telegram connection and user status.
    """
    is_connected = bool(telegram_service.client and telegram_service.client.is_connected() and telegram_service.is_running)
    return {
        "is_connected": is_connected,
        "status": telegram_service.status,
        "account": telegram_service.me_info,
        "last_error": telegram_service.last_error
    }
