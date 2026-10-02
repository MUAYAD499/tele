import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine, Base, SessionLocal
from backend.app.config import settings
from backend.app.models.keyword import Keyword
from backend.app.models.recipient import Recipient
from backend.app.models.settings import SystemSetting
from backend.app.services.arabic_normalizer import arabic_normalizer
from backend.app.services.telegram_client import telegram_service
from backend.app.workers.forward_worker import forward_worker

from backend.app.api.auth import router as auth_router
from backend.app.api.system import router as system_router
from backend.app.api.keywords import router as keywords_router
from backend.app.api.recipients import router as recipients_router
from backend.app.api.groups import router as groups_router
from backend.app.api.logs import router as logs_router
from backend.app.api.stats import router as stats_router
from backend.app.api.settings import router as settings_router

logger = logging.getLogger("main")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))


def seed_initial_data():
    """Initializes tables and seeds default Arabic keywords & target recipients if empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Default Keywords
        if db.query(Keyword).count() == 0:
            defaults = ["يحل", "يسوي", "فاهم", "يشرح", "يعرف", "مختص", "واجب", "تكليف", "مشروع"]
            for kw in defaults:
                db.add(Keyword(keyword=kw, normalized_keyword=arabic_normalizer.normalize(kw), enabled=True))

        # Default Target Recipients
        if db.query(Recipient).count() == 0:
            default_recipients = ["@topmark1st", "@tamkeenco3", "@m_9q6"]
            for r in default_recipients:
                db.add(Recipient(username=r, enabled=True))

        # Default Settings
        if not db.query(SystemSetting).filter(SystemSetting.key == "FORWARD_DELAY").first():
            db.add(SystemSetting(key="FORWARD_DELAY", value="2.0", description="Rate delay between forwards"))
        if not db.query(SystemSetting).filter(SystemSetting.key == "MONITOR_MODE").first():
            db.add(SystemSetting(key="MONITOR_MODE", value="ALL", description="ALL or SELECTED"))
        if not db.query(SystemSetting).filter(SystemSetting.key == "TIMEZONE").first():
            db.add(SystemSetting(key="TIMEZONE", value=settings.TIMEZONE))
        if not db.query(SystemSetting).filter(SystemSetting.key == "LOG_LEVEL").first():
            db.add(SystemSetting(key="LOG_LEVEL", value=settings.LOG_LEVEL))

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Database
    seed_initial_data()
    logger.info("Database schemas and seed data ready.")

    # 2. Start Forward Queue Worker
    worker_task = asyncio.create_task(forward_worker.start())

    # 3. Auto-connect Telegram if session exists
    asyncio.create_task(telegram_service.connect_and_start())

    yield

    # Shutdown
    forward_worker.stop()
    worker_task.cancel()
    if telegram_service.client and telegram_service.client.is_connected():
        await telegram_service.client.disconnect()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Telegram Userbot Filter & Forwarder API",
    description="Production-Ready Telegram MTProto Userbot for Arabic message filtering and forwarding",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(keywords_router)
app.include_router(recipients_router)
app.include_router(groups_router)
app.include_router(logs_router)
app.include_router(stats_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {
        "service": "Telegram Userbot Message Filter & Forwarder",
        "status": "online",
        "version": "1.0.0",
        "matching_rule": "يكفي وجود كلمة مفتاحية واحدة فقط",
        "api_docs": "/docs"
    }
