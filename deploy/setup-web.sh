#!/usr/bin/env bash
# One-time: host the website on this server (next to the API) instead of Netlify.
#   ./deploy/setup-web.sh getcompanio.in "www.getcompanio.in getcompanio.app www.getcompanio.app campanio.co.in www.campanio.co.in"
# Needs apps/web/.env.production.local (the website's settings). Then: ./deploy/deploy.sh builds and starts it.
# HTTPS certificates are requested automatically, per domain, as soon as its DNS points here (watch: /var/log/companio-certs.log).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${1:?main domain, e.g. getcompanio.in}"
REDIRECTS="${2:-}"
step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
[[ -f "$ROOT/apps/web/.env.production.local" ]] || { echo "Create apps/web/.env.production.local first." >&2; exit 1; }

step "Swap (so building the website can't run out of memory)"
if ! sudo swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
free -h | awk '/Swap:/{print "swap: "$2}'

step "Nginx site for $SITE"
sudo apt-get install -y dnsutils >/dev/null 2>&1 || true
{
  sed -e "s|__SITE_DOMAIN__|$SITE|g" "$ROOT/deploy/nginx-web.conf"
  # one block per other domain, so each gets its own certificate → the main site, same path
  for d in $REDIRECTS; do
    printf '\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name %s;\n    server_tokens off;\n    return 301 https://%s$request_uri;\n}\n' "$d" "$SITE"
  done
} | sudo tee /etc/nginx/sites-available/companio-web >/dev/null
sudo ln -sf /etc/nginx/sites-available/companio-web /etc/nginx/sites-enabled/companio-web
sudo nginx -t && sudo systemctl reload nginx

step "Certificates: requested automatically when each domain's DNS points here"
sudo install -m 755 "$ROOT/deploy/web-certs.sh" /usr/local/bin/companio-web-certs
sudo systemd-run --unit=companio-web-certs --collect /usr/local/bin/companio-web-certs $SITE $REDIRECTS >/dev/null 2>&1 \
  || echo "(already waiting for DNS)"
echo "Point the domains' A records to $(curl -s -m 5 ifconfig.me) — watch progress: sudo tail -f /var/log/companio-certs.log"
