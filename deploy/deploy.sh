#!/usr/bin/env bash
# Build and (re)start the API on the server. Safe to run for every update.
#   ./deploy/deploy.sh            # git pull, then deploy
#   ./deploy/deploy.sh --no-pull  # deploy the code as it is (first deploy, or local changes)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

[[ -f apps/api/.env ]] || { echo "apps/api/.env is missing — run deploy/setup-server.sh first." >&2; exit 1; }
PORT="$(grep -E '^PORT=' apps/api/.env | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-4000}"

if [[ "${1:-}" != "--no-pull" ]]; then
  step "Pulling latest code"
  git pull --ff-only
fi

step "Backing up the database before changing anything"
"$ROOT/deploy/backup.sh"

step "Installing dependencies (API + shared types only)"
npm ci --no-audit --no-fund --include-workspace-root --workspace @companio/api --workspace @companio/types

step "Building"
npm run db:generate -w @companio/api
npm run build -w @companio/types
npm run build -w @companio/api

step "Updating the database schema"
# `prisma db push` refuses changes that would delete data unless told otherwise, so this can't silently drop columns
npm run db:push -w @companio/api -- --skip-generate

step "Starting the API"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save >/dev/null

step "Health check"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/docs"; then
    printf '\033[1;32mAPI is up on port %s.\033[0m\n' "$PORT"
    exit 0
  fi
  sleep 1
done
echo "API did not come up. Last log lines:" >&2
pm2 logs companio-api --lines 40 --nostream >&2 || true
exit 1
