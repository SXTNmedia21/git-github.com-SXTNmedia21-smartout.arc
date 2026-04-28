# ============================================
# Dockerfile — Scrapling Service
# Multi-stage build: install dependencies, then run minimal Python image.
# Port 8000 — internal only, no external Caddy route.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Dependencies ───────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

# Install system dependencies for lxml, scrapling, curl_cffi, and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt1-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Runtime dependencies for lxml, curl_cffi, and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libxslt1.1 \
    libcurl4 \
    libjpeg62-turbo \
    libpng16-16 \
    libwebp7 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/deps /app/deps
ENV PYTHONPATH=/app/deps
COPY main.py intelligence.py dashboard.html ./
COPY extractors/ ./extractors/

EXPOSE 8000

# Persistent log directory — mounted as docker volume `scrapling_logs`
# in compose. Created and chown'd to `nobody` BEFORE the USER directive
# so a freshly initialized volume inherits the directory's ownership
# (Docker copies image perms into a fresh named volume on first mount).
RUN mkdir -p /data && chown nobody:nogroup /data

USER nobody
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
