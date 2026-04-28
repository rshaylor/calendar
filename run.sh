#!/usr/bin/with-contenv bashio
# Family Hub — Home Assistant add-on entrypoint.
# Reads add-on options from /data/options.json (via bashio) and starts uvicorn.
set -e

bashio::log.info "Starting Family Hub..."

GOOGLE_CLIENT_ID=$(bashio::config 'google_client_id')
GOOGLE_CLIENT_SECRET=$(bashio::config 'google_client_secret')
GOOGLE_REDIRECT_URI=$(bashio::config 'google_redirect_uri')
LOCATION_LAT=$(bashio::config 'location_lat')
LOCATION_LON=$(bashio::config 'location_lon')
CALENDAR_SYNC_SECONDS=$(bashio::config 'calendar_sync_seconds')

export GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI
export LOCATION_LAT LOCATION_LON CALENDAR_SYNC_SECONDS

cd /app
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
