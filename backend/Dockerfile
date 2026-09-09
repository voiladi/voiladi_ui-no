# Voiladi API - production image for Railway
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UPLOAD_DIR=/data/uploads \
    PORT=8001

WORKDIR /app

COPY requirements.deploy.txt ./
RUN pip install --no-cache-dir -r requirements.deploy.txt

COPY . .
RUN mkdir -p /data/uploads

EXPOSE 8001
# Railway injects $PORT; keep a sane default for local docker runs.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001} --proxy-headers --forwarded-allow-ips='*'"]
