from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.models.recipient import Recipient
from backend.app.schemas.schemas import RecipientCreate, RecipientUpdate, RecipientResponse
from backend.app.services.telegram_client import telegram_service

router = APIRouter(prefix="/api/recipients", tags=["Recipients Management"])

DEFAULT_RECIPIENTS = [
    "@topmark1st",
    "@tamkeenco3",
    "@m_9q6"
]


def clean_username(u: str) -> str:
    u = u.strip()
    if not u.startswith("@"):
        u = "@" + u
    return u


@router.get("", response_model=List[RecipientResponse])
async def list_recipients(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    recipients = db.query(Recipient).order_by(Recipient.id.asc()).all()
    if not recipients:
        for r in DEFAULT_RECIPIENTS:
            item = Recipient(username=r, enabled=True)
            db.add(item)
        db.commit()
        recipients = db.query(Recipient).order_by(Recipient.id.asc()).all()
    return recipients


@router.post("", response_model=RecipientResponse, status_code=status.HTTP_201_CREATED)
async def create_recipient(
    payload: RecipientCreate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    uname = clean_username(payload.username)
    if len(uname) <= 1:
        raise HTTPException(status_code=400, detail="اسم المستخدم غير صالح")

    existing = db.query(Recipient).filter(Recipient.username == uname).first()
    if existing:
        raise HTTPException(status_code=400, detail="المستلم موجود مسبقاً في القائمة")

    new_rec = Recipient(username=uname, enabled=True)
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)
    return new_rec


@router.put("/{recipient_id}", response_model=RecipientResponse)
async def update_recipient(
    recipient_id: int,
    payload: RecipientUpdate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    rec = db.query(Recipient).filter(Recipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="المستلم غير موجود")

    if payload.username is not None:
        new_uname = clean_username(payload.username)
        if len(new_uname) <= 1:
            raise HTTPException(status_code=400, detail="اسم المستخدم غير صالح")
        rec.username = new_uname

    if payload.enabled is not None:
        rec.enabled = payload.enabled

    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{recipient_id}", status_code=status.HTTP_200_OK)
async def delete_recipient(
    recipient_id: int,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    rec = db.query(Recipient).filter(Recipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="المستلم غير موجود")

    db.delete(rec)
    db.commit()
    return {"success": True, "message": "تم حذف المستلم بنجاح"}


@router.post("/{recipient_id}/test")
async def test_recipient(
    recipient_id: int,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    rec = db.query(Recipient).filter(Recipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="المستلم غير موجود")

    if not telegram_service.client or not telegram_service.client.is_connected():
        return {
            "success": False,
            "message": f"Telegram Userbot غير متصل حالياً. المستلم: {rec.username}"
        }

    try:
        # Send a test ping directly to verify access
        await telegram_service.client.send_message(
            entity=rec.username,
            message="🔔 رسالة اختبار من نظام فلترة وتحويل التيليجرام: الاتصال بالمستلم يعمل بنجاح."
        )
        return {"success": True, "message": f"تم إرسال رسالة اختبار بنجاح إلى {rec.username}"}
    except Exception as e:
        return {"success": False, "error": f"تعذر الإرسال إلى {rec.username}: {str(e)}"}
