# Stage 1: Build Frontend Dashboard
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Python Backend + Static Dashboard
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend and Built Frontend
COPY backend/ ./backend/
COPY --from=frontend-builder /frontend/dist ./dist

# Create persistent data directory
RUN mkdir -p /app/data

# Environment Defaults
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:///./data/database.db
ENV DATA_DIR=/app/data
ENV TELEGRAM_SESSION_NAME=userbot
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start Server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "3000"]
