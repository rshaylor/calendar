#!/usr/bin/env bash
# One-shot Pi bootstrap. Run from inside the cloned repo:
#   git clone https://github.com/rshaylor/calendar.git ~/calendar
#   cd ~/calendar && bash scripts/pi-setup.sh
#
# Idempotent — safe to re-run.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="${USER:-$(id -un)}"

echo "==> Repo: $REPO_DIR"
echo "==> User: $USER_NAME"

# 1. Install Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER_NAME"
  echo "(you'll need to log out and back in for the docker group to take effect)"
else
  echo "==> Docker already installed"
fi

# 2. Write systemd deploy service + timer
echo "==> Installing systemd deploy timer"
sudo tee /etc/systemd/system/familyhub-deploy.service >/dev/null <<EOF
[Unit]
Description=Family Hub deploy poller (git pull + docker compose)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=$USER_NAME
WorkingDirectory=$REPO_DIR
ExecStart=/bin/bash $REPO_DIR/scripts/deploy.sh
EOF

sudo tee /etc/systemd/system/familyhub-deploy.timer >/dev/null <<'EOF'
[Unit]
Description=Run Family Hub deploy poller every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=60sec
Unit=familyhub-deploy.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now familyhub-deploy.timer

echo
echo "============================================================"
echo "  Pi setup complete."
echo "============================================================"
echo
echo "Next steps:"
echo "  1. Create $REPO_DIR/apps/api/.env with your Google credentials:"
echo
echo "     GOOGLE_CLIENT_ID=...apps.googleusercontent.com"
echo "     GOOGLE_CLIENT_SECRET=..."
echo "     GOOGLE_REDIRECT_URI=http://familyhub.local/api/calendar/callback"
echo
echo "  2. Add this redirect URI to your Google OAuth client in Cloud Console:"
echo "       http://familyhub.local/api/calendar/callback"
echo
echo "  3. First build (the timer will pick up future updates automatically):"
echo "       cd $REPO_DIR && docker compose -f docker-compose.prod.yml up -d --build"
echo
echo "  4. Browse from your laptop: http://familyhub.local"
echo
echo "Useful commands:"
echo "  systemctl status familyhub-deploy.timer       # check timer state"
echo "  journalctl -u familyhub-deploy.service -f     # tail deploy logs"
echo "  docker compose -f docker-compose.prod.yml logs -f app   # tail app logs"
