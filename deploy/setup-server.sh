#!/usr/bin/env bash
# One-time setup of an Ubuntu 22.04/24.04 server for the Companio API + database.
#   Usage (as a normal user with sudo, from the cloned repo):
#     ./deploy/setup-server.sh api.yourdomain.com you@yourdomain.com
#   Before running: point the domain's DNS A record at this server (needed for the HTTPS certificate).
set -euo pipefail

API_DOMAIN="${1:-}"
EMAIL="${2:-}"
if [[ -z "$API_DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <api-domain> <email-for-https-notices>" >&2
  exit 1
fi
if [[ $EUID -eq 0 ]]; then
  echo "Run this as a normal user with sudo rights, not as root (PM2 should not run as root)." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA=/srv/companio-data
step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

step "Installing system packages"
sudo apt-get update -y
sudo apt-get install -y git curl nginx sqlite3 build-essential ufw certbot python3-certbot-nginx

step "Installing Node.js 20"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
command -v pm2 >/dev/null || sudo npm install -g pm2

step "Firewall: allow SSH and web traffic only"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

step "Data folders in $DATA (database, uploads, backups)"
sudo mkdir -p "$DATA/uploads" "$DATA/backups"
sudo chown -R "$USER":"$USER" "$DATA"
chmod 700 "$DATA" # KYC documents live here

step "API settings (apps/api/.env)"
ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "Keeping existing $ENV_FILE"
else
  sed -e "s|__JWT_SECRET__|$(openssl rand -hex 48)|" -e "s|__KYC_KEY__|$(openssl rand -base64 32)|" -e "s|__API_DOMAIN__|$API_DOMAIN|g" "$ROOT/deploy/api.env.production" >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE with a random JWT_SECRET"
fi

step "Nginx site for $API_DOMAIN"
sed "s|__API_DOMAIN__|$API_DOMAIN|g" "$ROOT/deploy/nginx-api.conf" | sudo tee /etc/nginx/sites-available/companio-api >/dev/null
sudo ln -sf /etc/nginx/sites-available/companio-api /etc/nginx/sites-enabled/companio-api
sudo nginx -t
sudo systemctl reload nginx

step "HTTPS certificate (Let's Encrypt)"
if ! sudo certbot --nginx -d "$API_DOMAIN" -m "$EMAIL" --agree-tos --redirect --non-interactive; then
  echo "Certificate failed — usually DNS for $API_DOMAIN doesn't point here yet. Fix DNS, then run:"
  echo "  sudo certbot --nginx -d $API_DOMAIN -m $EMAIL --agree-tos --redirect"
fi

step "Start the API automatically on reboot"
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null
echo "PM2 boot service installed"

step "Daily database + uploads backup at 03:15"
CRON="15 3 * * * $ROOT/deploy/backup.sh >> $DATA/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -vF "deploy/backup.sh"; echo "$CRON") | crontab -
echo "Installed: $CRON"

cat <<EOF

$(printf '\033[1;32m')Server ready.$(printf '\033[0m') Next:
  1. Edit $ENV_FILE — set CORS_ORIGINS and WEB_URL to your Netlify site URLs,
     your Razorpay keys, SMS provider, ADMIN_EMAIL and ADMIN_PASSWORD.
  2. ./deploy/deploy.sh --no-pull                       # install, build, create database, start the API
  3. npm run db:create-admin -w @companio/api           # admin account (no demo data)
  4. On Netlify (web + admin sites) set NEXT_PUBLIC_API_URL=https://$API_DOMAIN and redeploy.
  5. Razorpay webhook: https://$API_DOMAIN/payments/webhook/razorpay
EOF
