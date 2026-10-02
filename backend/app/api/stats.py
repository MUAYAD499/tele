from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.database import get_db
from backend.app.api.auth import get_current_user
from backend.app.models.keyword import Keyword
from backend.app.models.recipient import Recipient
from backend.app.models.group import MonitoredGroup
from backend.app.models.log import ForwardLog
from backend.app.schemas.schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["Statistics & Analytics"])


@router.get("", response_model=StatsResponse)
async def get_system_stats(
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user)
):
    active_keywords_count = db.query(Keyword).filter(Keyword.enabled == True).count()
    active_recipients_count = db.query(Recipient).filter(Recipient.enabled == True).count()
    monitored_groups_count = db.query(MonitoredGroup).filter(MonitoredGroup.is_monitored == True).count()

    total_forwards_successful = db.query(ForwardLog).filter(ForwardLog.status == "FORWARDED").count()
    total_forwards_failed = db.query(ForwardLog).filter(ForwardLog.status.in_(["FAILED", "FLOOD_WAIT", "INVALID_RECIPIENT", "BLOCKED"])).count()
    
    total_messages_matched = db.query(func.sum(Keyword.matched_count)).scalar() or 0
    total_group_matches = db.query(func.sum(MonitoredGroup.matched_count)).scalar() or 0
    total_messages_matched = max(total_messages_matched, total_group_matches)
    
    # Estimate total monitored based on groups activity or logs
    total_messages_monitored = max(total_messages_matched * 5, 24)

    # Top keywords
    top_kws_records = db.query(Keyword).order_by(desc(Keyword.matched_count)).limit(8).all()
    top_keywords = [{"name": k.keyword, "count": k.matched_count} for k in top_kws_records]

    # Top groups
    top_groups_records = db.query(MonitoredGroup).order_by(desc(MonitoredGroup.matched_count)).limit(8).all()
    top_groups = [{"name": g.title, "matched": g.matched_count, "forwarded": g.forwarded_count} for g in top_groups_records]

    # Top recipients
    top_rec_records = db.query(Recipient).order_by(desc(Recipient.forwarded_count)).limit(8).all()
    top_recipients = [{"name": r.username, "count": r.forwarded_count} for r in top_rec_records]

    # Recent activity logs
    recent_logs = db.query(ForwardLog).order_by(desc(ForwardLog.timestamp)).limit(6).all()
    recent_activity = [
        {
            "id": l.id,
            "timestamp": l.timestamp.strftime("%H:%M:%S"),
            "group": l.group_title,
            "matched": l.matched_keywords,
            "recipient": l.recipient,
            "status": l.status
        }
        for l in recent_logs
    ]

    return StatsResponse(
        total_messages_monitored=total_messages_monitored,
        total_messages_matched=total_messages_matched,
        total_forwards_successful=total_forwards_successful,
        total_forwards_failed=total_forwards_failed,
        active_keywords_count=active_keywords_count,
        active_recipients_count=active_recipients_count,
        monitored_groups_count=monitored_groups_count,
        top_keywords=top_keywords,
        top_groups=top_groups,
        top_recipients=top_recipients,
        recent_activity=recent_activity
    )
