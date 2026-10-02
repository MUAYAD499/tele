from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger
from backend.app.database import Base


class MonitoredGroup(Base):
    __tablename__ = "monitored_groups"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    username = Column(String(255), nullable=True)
    members_count = Column(Integer, default=0, nullable=True)
    is_monitored = Column(Boolean, default=True, nullable=False)
    matched_count = Column(Integer, default=0, nullable=False)
    forwarded_count = Column(Integer, default=0, nullable=False)
    last_activity_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
