# FROM python:3.11-slim-bookworm

# WORKDIR /app

# # System dependencies required by Playwright's bundled Chromium
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
#     libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
#     libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
#     libcairo2 libgdk-pixbuf2.0-0 libgtk-3-0 libx11-xcb1 \
#     libxcb-dri3-0 wget ca-certificates fonts-liberation \
#     && rm -rf /var/lib/apt/lists/*

# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt \
#     && playwright install chromium \
#     && playwright install-deps chromium

# COPY . .

# EXPOSE 8000

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.11-slim-bookworm

WORKDIR /app

# Minimal system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser + all required system dependencies
RUN playwright install --with-deps chromium

# Copy application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]