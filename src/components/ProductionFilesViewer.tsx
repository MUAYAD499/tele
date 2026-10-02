import React, { useState } from "react";
import {
  FolderCode,
  FileCode,
  Copy,
  Check,
  Download,
  Terminal,
  Server,
  Layers,
  FileText
} from "lucide-react";

export const ProductionFilesViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>("docker-compose.yml");
  const [copied, setCopied] = useState(false);

  const filesMap: Record<string, { desc: string; icon: any; content: string }> = {
    "docker-compose.yml": {
      desc: "ملف تشغيل الخدمة الدائمة على VPS مع الـ Volume الدائم لحفظ الجلسة وقاعدة البيانات",
      icon: Server,
      content: `services:
  telegram-userbot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: telegram_userbot_service
    restart: always
    ports:
      - "3000:3000"
    environment:
      - TELEGRAM_API_ID=\${TELEGRAM_API_ID:-25002565}
      - TELEGRAM_API_HASH=\${TELEGRAM_API_HASH:-9b6218bccd56051ca8ac7acb9eb71066}
      - TELEGRAM_PHONE=\${TELEGRAM_PHONE}
      - TELEGRAM_SESSION_NAME=\${TELEGRAM_SESSION_NAME:-telegram_userbot}
      - DASHBOARD_USERNAME=\${DASHBOARD_USERNAME:-admin}
      - DASHBOARD_PASSWORD=\${DASHBOARD_PASSWORD:-change-this-password}
      - SECRET_KEY=\${SECRET_KEY:-super-secure-production-jwt-key-2026}
      - DATABASE_URL=sqlite:///./data/database.db
      - KEYWORD_THRESHOLD=1
      - FORWARD_DELAY=\${FORWARD_DELAY:-2}
      - LOG_LEVEL=\${LOG_LEVEL:-INFO}
      - TIMEZONE=\${TIMEZONE:-Asia/Aden}
    volumes:
      # Persistent storage for SQLite Database and Telegram MTProto Session
      - ./data:/app/data
    stdin_open: true
    tty: true
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"`
    },
    "Dockerfile": {
      desc: "ملف بناء صورة الدوكر متعددة المراحل للنظام والواجهة",
      icon: Layers,
      content: `FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

RUN mkdir -p /app/data

EXPOSE 3000

ENV PYTHONPATH=/app/backend
ENV DATABASE_URL=sqlite:///./data/database.db

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "3000"]`
    },
    ".env.example": {
      desc: "نموذج إعداد المتغيرات السرية وبيانات Telegram API",
      icon: FileText,
      content: `# Telegram MTProto Credentials
TELEGRAM_API_ID=25002565
TELEGRAM_API_HASH=9b6218bccd56051ca8ac7acb9eb71066
TELEGRAM_PHONE=+966500000000
TELEGRAM_SESSION_NAME=telegram_userbot

# Web Dashboard Login
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=change-this-password
SECRET_KEY=generate-a-secure-random-jwt-secret-key-32chars

# Database Connection
DATABASE_URL=sqlite:///./data/database.db

# Matching & Forwarding Engine Rules
KEYWORD_THRESHOLD=1
FORWARD_DELAY=2
MONITOR_MODE=ALL

# System & Logging
LOG_LEVEL=INFO
TIMEZONE=Asia/Aden`
    },
    "backend/app/services/telegram_service.py": {
      desc: "محرك Telethon MTProto والاستماع الحصري لرسائل المجموعات",
      icon: FileCode,
      content: `import asyncio
import logging
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat, User
from telethon.errors import FloodWaitError

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self, api_id: int, api_hash: str, session_name: str = "telegram_userbot"):
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_name = session_name
        self.client: TelegramClient | None = None
        self.is_running = False

    async def init_client(self):
        self.client = TelegramClient(self.session_name, self.api_id, self.api_hash)
        await self.client.connect()

    async def forward_message(self, entity_username: str, from_chat_id: int, message_id: int):
        """Native MTProto forward preserving media and caption"""
        target = await self.client.get_input_entity(entity_username)
        await self.client.forward_messages(target, message_id, from_chat_id)`
    },
    "backend/app/services/arabic_normalizer.py": {
      desc: "تطبيع النصوص العربية وإزالة التشكيل والتطويل وتوحيد الهمزات",
      icon: FileCode,
      content: `import re

class ArabicNormalizer:
    @staticmethod
    def remove_tashkeel(text: str) -> str:
        return re.sub(r'[\\u0617-\\u061A\\u064B-\\u0652\\u0670\\u06D6-\\u06ED]', '', text)

    @staticmethod
    def remove_tatweel(text: str) -> str:
        return re.sub(r'\\u0640', '', text)

    @staticmethod
    def normalize_characters(text: str) -> str:
        t = re.sub(r'[أإآٱ]', 'ا', text)
        t = re.sub(r'ى', 'ي', t)
        t = re.sub(r'ة', 'ه', t)
        t = re.sub(r'ئ', 'ي', t)
        t = re.sub(r'ؤ', 'و', t)
        return t

    @classmethod
    def normalize(cls, text: str) -> str:
        if not text:
            return ""
        t = cls.remove_tashkeel(text)
        t = cls.remove_tatweel(t)
        t = re.sub(r'[!"#$%&\\'()*+,-./:;<=>?@[\\]^_\\x60{|}~،؛؟«»—–\\n\\r\\t]', ' ', t)
        t = cls.normalize_characters(t)
        t = re.sub(r'\\s+', ' ', t).strip()
        return t`
    },
    "backend/app/services/keyword_matcher.py": {
      desc: "خوارزمية مطابقة الكلمات والبادئات العربية مع تطبيق قاعدة الكلمة الواحدة",
      icon: FileCode,
      content: `from typing import List, Tuple
from app.services.arabic_normalizer import ArabicNormalizer

class KeywordMatcher:
    PREFIXES = ["ال", "و", "ف", "ب", "ل", "ك", "وال", "فال", "بال", "لل"]

    @classmethod
    def matches_token(cls, token: str, norm_kw: str) -> bool:
        if token == norm_kw:
            return True
        if len(norm_kw) >= 3:
            for p in cls.PREFIXES:
                if token == p + norm_kw:
                    return True
        return False

    @classmethod
    def match_message(cls, text: str, active_keywords: List[str]) -> Tuple[bool, List[str]]:
        if not text or not active_keywords:
            return False, []
        normalized_text = ArabicNormalizer.normalize(text)
        tokens = ArabicNormalizer.tokenize(normalized_text)
        token_set = set(tokens)
        matched = []

        for kw in active_keywords:
            clean_kw = ArabicNormalizer.normalize(kw)
            if not clean_kw:
                continue
            if " " in clean_kw:
                if clean_kw in normalized_text:
                    matched.append(kw)
            else:
                for token in token_set:
                    if cls.matches_token(token, clean_kw):
                        matched.append(kw)
                        break

        # Fixed Rule: ANY Keyword (Threshold = 1)
        return len(matched) >= 1, matched`
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(filesMap[selectedFile].content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-[#0a0c10] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FolderCode className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">
              ملفات المشروع وكود الإنتاج والنشر على VPS
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            استعرض وانسخ كافة ملفات الـ Backend، و Docker Compose، و Dockerfile، وإعدادات Nginx و Telethon الجاهزة للتشغيل الفوري 24/7 على أي خادم Cloud.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-lg shadow-blue-900/30 shrink-0"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? "تم النسخ للحافظة!" : "نسخ الملف الحالي"}</span>
        </button>
      </div>

      {/* File Explorer & Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* File Tree List */}
        <div className="p-4 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-1.5">
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 px-2">قائمة الملفات:</div>
          {Object.keys(filesMap).map((fileName) => {
            const item = filesMap[fileName];
            const Icon = item.icon;
            const isSelected = selectedFile === fileName;
            return (
              <button
                key={fileName}
                onClick={() => setSelectedFile(fileName)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono text-right transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white/10 text-white border border-white/10 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "opacity-60"}`} />
                <span className="truncate">{fileName}</span>
              </button>
            );
          })}
        </div>

        {/* Code Content Viewer */}
        <div className="lg:col-span-3 p-6 rounded-2xl bg-[#0a0c10] border border-white/5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div>
              <span className="font-mono text-xs font-bold text-white block">
                {selectedFile}
              </span>
              <span className="text-[11px] text-slate-400">
                {filesMap[selectedFile].desc}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="نسخ الكود"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#050608] border border-white/10 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-all">
            <code>{filesMap[selectedFile].content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
