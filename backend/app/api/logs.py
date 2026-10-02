from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.models.log import ForwardLog
from backend.app.schemas.schemas import LogResponse

router = APIRouter(prefix="/api/logs", tags=["Logs & History"])


@router.get("", response_model=List[LogResponse])
async def list_logs(
    status: Optional[str] = None,
    recipient: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    query = db.query(ForwardLog)

    if status and status != "ALL":
        query = query.filter(ForwardLog.status == status)

    if recipient:
        query = query.filter(ForwardLog.recipient == recipient)

    if keyword:
        query = query.filter(ForwardLog.matched_keywords.contains(keyword))

    logs = query.order_by(desc(ForwardLog.timestamp)).offset(offset).limit(limit).all()
    return logs


@router.delete("")
async def clear_logs(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    db.query(ForwardLog).delete()
    db.commit()
    return {"success": True, "message": "تم مسح السجلات بنجاح"}
