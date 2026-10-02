from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: str


# Keywords
class KeywordBase(BaseModel):
    keyword: str


class KeywordCreate(KeywordBase):
    pass


class KeywordUpdate(BaseModel):
    keyword: Optional[str] = None
    enabled: Optional[bool] = None


class KeywordResponse(BaseModel):
    id: int
    keyword: str
    normalized_keyword: str
    enabled: bool
    matched_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Recipients
class RecipientBase(BaseModel):
    username: str


class RecipientCreate(RecipientBase):
    pass


class RecipientUpdate(BaseModel):
    username: Optional[str] = None
    enabled: Optional[bool] = None


class RecipientResponse(BaseModel):
    id: int
    username: str
    enabled: bool
    forwarded_count: int
    last_forward_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Groups
class GroupUpdate(BaseModel):
    is_monitored: bool


class GroupResponse(BaseModel):
    id: int
    chat_id: int
    title: str
    username: Optional[str] = None
    members_count: Optional[int] = None
    is_monitored: bool
    matched_count: int
    forwarded_count: int
    last_activity_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Logs
class LogResponse(BaseModel):
    id: int
    timestamp: datetime
    group_title: Optional[str]
    chat_id: int
    message_id: int
    sender_name: Optional[str]
    matched_keywords: str
    recipient: Optional[str]
    status: str
    error_message: Optional[str]

    class Config:
        from_attributes = True


# Stats
class StatsResponse(BaseModel):
    total_messages_monitored: int
    total_messages_matched: int
    total_forwards_successful: int
    total_forwards_failed: int
    active_keywords_count: int
    active_recipients_count: int
    monitored_groups_count: int
    top_keywords: List[Dict[str, Any]]
    top_groups: List[Dict[str, Any]]
    top_recipients: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]


# System & Settings
class SystemStatusResponse(BaseModel):
    status: str  # RUNNING, STOPPED, STARTING, STOPPING, RECONNECTING, ERROR
    is_connected: bool
    session_exists: bool
    account: Optional[Dict[str, Any]] = None
    monitor_mode: str
    matching_rule: str = "يكفي وجود كلمة مفتاحية واحدة فقط"
    keyword_threshold: int = 1
    queue_size: int
    last_error: Optional[str] = None


class SettingsUpdate(BaseModel):
    forward_delay: Optional[float] = None
    retry_attempts: Optional[int] = None
    monitor_mode: Optional[str] = None  # ALL / SELECTED
    timezone: Optional[str] = None
    log_level: Optional[str] = None


# Telegram Auth Flow
class TelegramPhoneRequest(BaseModel):
    phone: str


class TelegramCodeRequest(BaseModel):
    code: str
    password: Optional[str] = None
    phone: Optional[str] = None
    phone_code_hash: Optional[str] = None


class TelegramPasswordRequest(BaseModel):
    password: str


# Live Message Test
class MessageTestRequest(BaseModel):
    text: str


class MessageTestResponse(BaseModel):
    raw_text: str
    normalized_text: str
    tokens: List[str]
    is_match: bool
    matched_keywords: List[str]
    matching_rule: str
    explanation: str
