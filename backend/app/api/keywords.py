from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.models.keyword import Keyword
from backend.app.schemas.schemas import KeywordCreate, KeywordUpdate, KeywordResponse
from backend.app.services.arabic_normalizer import arabic_normalizer

router = APIRouter(prefix="/api/keywords", tags=["Keywords Management"])

DEFAULT_KEYWORDS = [
    "يحل",
    "يسوي",
    "فاهم",
    "يشرح",
    "يعرف",
    "مختص",
    "واجب",
    "تكليف",
    "مشروع"
]


@router.get("", response_model=List[KeywordResponse])
async def list_keywords(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    keywords = db.query(Keyword).order_by(Keyword.id.asc()).all()
    if not keywords:
        # Seed defaults
        for kw in DEFAULT_KEYWORDS:
            normalized = arabic_normalizer.normalize(kw)
            item = Keyword(keyword=kw, normalized_keyword=normalized, enabled=True)
            db.add(item)
        db.commit()
        keywords = db.query(Keyword).order_by(Keyword.id.asc()).all()
    return keywords


@router.post("", response_model=KeywordResponse, status_code=status.HTTP_201_CREATED)
async def create_keyword(
    payload: KeywordCreate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    raw_kw = payload.keyword.strip()
    if not raw_kw:
        raise HTTPException(status_code=400, detail="الكلمة المفتاحية لا يمكن أن تكون فارغة")

    normalized = arabic_normalizer.normalize(raw_kw)

    existing = db.query(Keyword).filter(Keyword.keyword == raw_kw).first()
    if existing:
        raise HTTPException(status_code=400, detail="الكلمة المفتاحية موجودة مسبقاً")

    new_kw = Keyword(
        keyword=raw_kw,
        normalized_keyword=normalized,
        enabled=True
    )
    db.add(new_kw)
    db.commit()
    db.refresh(new_kw)
    return new_kw


@router.put("/{keyword_id}", response_model=KeywordResponse)
async def update_keyword(
    keyword_id: int,
    payload: KeywordUpdate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    kw = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="الكلمة المفتاحية غير موجودة")

    if payload.keyword is not None:
        new_raw = payload.keyword.strip()
        if not new_raw:
            raise HTTPException(status_code=400, detail="الكلمة المفتاحية لا يمكن أن تكون فارغة")
        kw.keyword = new_raw
        kw.normalized_keyword = arabic_normalizer.normalize(new_raw)

    if payload.enabled is not None:
        kw.enabled = payload.enabled

    db.commit()
    db.refresh(kw)
    return kw


@router.delete("/{keyword_id}", status_code=status.HTTP_200_OK)
async def delete_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    kw = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="الكلمة المفتاحية غير موجودة")

    db.delete(kw)
    db.commit()
    return {"success": True, "message": "تم حذف الكلمة المفتاحية بنجاح"}
