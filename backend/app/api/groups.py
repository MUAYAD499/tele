from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.models.group import MonitoredGroup
from backend.app.schemas.schemas import GroupResponse, GroupUpdate
from backend.app.services.telegram_client import telegram_service

router = APIRouter(prefix="/api/groups", tags=["Groups Management"])


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    groups = db.query(MonitoredGroup).order_by(MonitoredGroup.matched_count.desc(), MonitoredGroup.id.asc()).all()
    return groups


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group_monitoring(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    group = db.query(MonitoredGroup).filter(MonitoredGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")

    group.is_monitored = payload.is_monitored
    db.commit()
    db.refresh(group)
    return group


@router.post("/sync")
async def sync_groups(user: str = Depends(get_current_user)):
    try:
        groups = await telegram_service.fetch_joined_groups()
        return {"success": True, "count": len(groups), "groups": groups}
    except Exception as e:
        return {"success": False, "error": str(e)}
