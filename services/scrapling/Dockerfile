# ============================================
# Dockerfile — Scrapling Service
# Multi-stage build: install dependencies, then run minimal Python image.
# Port 8000 — internal only, no external Caddy route.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Dependencies ───────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

# Install system dependencies for lxml and scrapling
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Runtime dependencies for lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/deps /app/deps
ENV PYTHONPATH=/app/deps
COPY main.py ./

EXPOSE 8000
USER nobody
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
