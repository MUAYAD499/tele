import os
import asyncio
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.app.database import engine, Base, SessionLocal
from backend.app.config import settings

# -------------------------------------------------------------------
# Automatic Directory Initialization & Permission Setup (Fix HTTP 500)
# -------------------------------------------------------------------
DATA_DIR = os.getenv("DATA_DIR", settings.DATA_DIR or "./data")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", settings.TELEGRAM_SESSION_NAME or "userbot")
SESSION_PATH = os.path.join(DATA_DIR, SESSION_NAME)

os.makedirs(os.path.dirname(SESSION_PATH), exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
try:
    os.chmod(DATA_DIR, 0o777)
    os.chmod(os.path.dirname(SESSION_PATH), 0o777)
except Exception:
    pass

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
from backend.app.api.telegram import router as telegram_router

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

    # 2. Auto-connect Telegram if session exists (Non-blocking)
    asyncio.create_task(telegram_service.connect_and_start())

    # 3. 24/7 Auto-Reconnection & Health Keep-Alive Task (Every 60s)
    reconnect_task = asyncio.create_task(telegram_service.start_auto_reconnect_loop())

    yield

    # Clean Shutdown without deleting session
    reconnect_task.cancel()
    if telegram_service.client and telegram_service.client.is_connected():
        await telegram_service.client.disconnect()
    logger.info("Application shutdown complete. Telegram session preserved.")


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

# -------------------------------------------------------------
# Keep-Alive & Health Monitoring (UptimeRobot & Render 24/7)
# -------------------------------------------------------------
@app.get("/health")
@app.head("/health")
@app.get("/api/health")
@app.head("/api/health")
async def health_check():
    """Ultra-fast keep-alive health check for UptimeRobot, Render, and monitoring bots."""
    return {
        "status": "healthy",
        "service": "telegram-userbot",
        "telegram_status": telegram_service.status,
        "is_connected": bool(telegram_service.client and telegram_service.client.is_connected()),
        "is_running": telegram_service.is_running,
        "timestamp": datetime.utcnow().isoformat()
    }


# Routers
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(keywords_router)
app.include_router(recipients_router)
app.include_router(groups_router)
app.include_router(logs_router)
app.include_router(stats_router)
app.include_router(settings_router)
app.include_router(telegram_router)


# -------------------------------------------------------------
# Static Files & Frontend (dist) Hosting
# -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DIST_DIR = BASE_DIR / "dist"
if not DIST_DIR.exists():
    cwd_dist = Path.cwd() / "dist"
    if cwd_dist.exists():
        DIST_DIR = cwd_dist

# Mount Vite static assets directory if present
assets_dir = DIST_DIR / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/")
@app.head("/")
async def root():
    """
    Serves the compiled React frontend dashboard (index.html) directly from dist.
    Falls back to informative status JSON if frontend is not yet built.
    """
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))
    return {
        "service": "Telegram Userbot Message Filter & Forwarder",
        "status": "online",
        "version": "1.0.0",
        "matching_rule": "يكفي وجود كلمة مفتاحية واحدة فقط",
        "api_docs": "/docs",
        "message": "dist/index.html not found. Run 'npm run build' to build React frontend."
    }


@app.get("/{full_path:path}")
async def serve_spa_or_static(full_path: str):
    """
    Serves static files directly from dist or falls back to index.html for client-side routing.
    Preserves 404 for unmatched API routes.
    """
    # Do not intercept API or docs routes
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint not found")
    if full_path in ("docs", "redoc", "openapi.json"):
        raise HTTPException(status_code=404, detail="Not found")

    # Check for direct file in dist (e.g. favicon.ico, images)
    static_file = DIST_DIR / full_path
    if static_file.is_file():
        return FileResponse(str(static_file))

    # SPA fallback for React Router pages
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))

    raise HTTPException(status_code=404, detail="Not found")
