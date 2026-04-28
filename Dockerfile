# Home Assistant add-on Dockerfile.
# (For direct Pi deploy via docker-compose, see Dockerfile.prod.)
#
# BUILD_FROM is set by the HA supervisor per architecture; a default is
# provided so local `docker build` works for testing.
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.18

# Stage 1: build the React frontend (Node Alpine, arch-agnostic).
FROM node:22-alpine AS web-build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# Stage 2: HA add-on runtime — Alpine base with bashio for options handling.
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

COPY apps/api/requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY apps/api/ ./
COPY --from=web-build /web/dist ./static

ENV STATIC_DIR=/app/static
ENV DATABASE_URL=sqlite:////data/app.db

COPY run.sh /
RUN chmod a+x /run.sh

CMD ["/run.sh"]
