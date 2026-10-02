from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Text
from backend.app.database import Base


class ForwardLog(Base):
    __tablename__ = "forward_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    group_title = Column(String(255), nullable=True)
    chat_id = Column(BigInteger, nullable=False, index=True)
    message_id = Column(Integer, nullable=False, index=True)
    sender_name = Column(String(255), nullable=True)
    matched_keywords = Column(String(255), nullable=False)  # Comma-separated or JSON
    recipient = Column(String(255), nullable=True, index=True)
    status = Column(String(50), nullable=False, index=True)  # QUEUED, FORWARDED, FAILED, PROTECTED_CONTENT, SKIPPED
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
