from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, UniqueConstraint
from backend.app.database import Base


class ProcessedMessage(Base):
    __tablename__ = "processed_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(BigInteger, nullable=False, index=True)
    message_id = Column(Integer, nullable=False, index=True)
    recipient = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="PROCESSED", nullable=False)  # PROCESSED, FORWARDED, FAILED
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("chat_id", "message_id", "recipient", name="uq_chat_msg_recipient"),
    )
