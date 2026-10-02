import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Telegram API Credentials
    TELEGRAM_API_ID: int = int(os.getenv("TELEGRAM_API_ID", "25002565"))
    TELEGRAM_API_HASH: str = os.getenv("TELEGRAM_API_HASH", "9b6218bccd56051ca8ac7acb9eb71066")
    TELEGRAM_PHONE: Optional[str] = os.getenv("TELEGRAM_PHONE", None)
    TELEGRAM_SESSION_NAME: str = os.getenv("TELEGRAM_SESSION_NAME", "userbot")
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")

    # Dashboard Authentication
    DASHBOARD_USERNAME: str = os.getenv("DASHBOARD_USERNAME", "admin")
    DASHBOARD_PASSWORD: str = os.getenv("DASHBOARD_PASSWORD", "change-this-password")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-please-change-in-production-random-hash")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/database.db")

    # Filtering & Forwarding Rules
    KEYWORD_THRESHOLD: int = 1  # Fixed rule: ANY single keyword matches
    FORWARD_DELAY: float = float(os.getenv("FORWARD_DELAY", "2.0"))
    MAX_RETRY_ATTEMPTS: int = 3
    MONITOR_MODE: str = os.getenv("MONITOR_MODE", "ALL")  # 'ALL' or 'SELECTED'

    # System & Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Aden")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
