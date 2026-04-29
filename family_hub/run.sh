#!/usr/bin/with-contenv bashio
# Family Hub — Home Assistant add-on entrypoint.
# Reads add-on options from /data/options.json (via bashio) and starts uvicorn.
# Calendar data flows through HA's own API (SUPERVISOR_TOKEN is auto-injected
# by the Supervisor when homeassistant_api: true is set in config.yaml).
set -e

bashio::log.info "Starting Family Hub..."

LOCATION_LAT=$(bashio::config 'location_lat')
LOCATION_LON=$(bashio::config 'location_lon')

export LOCATION_LAT LOCATION_LON

cd /app
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
