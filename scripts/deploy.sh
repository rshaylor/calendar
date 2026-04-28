#!/usr/bin/env bash
# Auto-deploy: poll GitHub for new commits on main and rebuild if found.
# Designed to be invoked by a systemd timer every ~60s.
set -euo pipefail

cd "$(dirname "$0")/.."

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date -Is)  update found: $LOCAL -> $REMOTE"
# Discard any local edits — this host is a deploy target, not an edit target.
git reset --hard origin/main
docker compose -f docker-compose.prod.yml up -d --build
echo "$(date -Is)  deploy complete"
