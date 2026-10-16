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

step "Checking settings"
# ID documents are encrypted at rest; older servers get a key the first time they deploy this version
if ! grep -qE '^KYC_ENCRYPTION_KEY=.{40,}' apps/api/.env; then
  sed -i '/^KYC_ENCRYPTION_KEY=/d' apps/api/.env
  echo "KYC_ENCRYPTION_KEY=$(openssl rand -base64 32)" >>apps/api/.env
  echo "Added a KYC_ENCRYPTION_KEY to apps/api/.env — save a copy somewhere safe (password manager):"
  echo "without it, ID documents in backups can't be read."
fi

step "Backing up the database before changing anything"
"$ROOT/deploy/backup.sh"

# the website is built here too once the server has its settings (apps/web/.env.production.local); else Netlify hosts it
WEB=0; [[ -f apps/web/.env.production.local ]] && WEB=1

step "Installing dependencies"
if [[ $WEB == 1 ]]; then
  npm ci --no-audit --no-fund --include-workspace-root --workspace @companio/api --workspace @companio/types --workspace @companio/web --workspace @companio/ui --workspace @companio/api-client
else
  npm ci --no-audit --no-fund --include-workspace-root --workspace @companio/api --workspace @companio/types
fi

step "Building"
npm run db:generate -w @companio/api
npm run build -w @companio/types
npm run build -w @companio/api
if [[ $WEB == 1 ]]; then
  # `next build` wipes the folder the live site serves from, so build in a copy and swap it in when it's done:
  # visitors never see a half-built site
  BUILD="$ROOT/.web-build"
  mkdir -p "$BUILD"
  rsync -a --delete --exclude node_modules --exclude .next --exclude .git --exclude .web-build \
    "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/tsconfig.base.json" "$ROOT/apps" "$ROOT/packages" "$BUILD/"
  ln -sfn "$ROOT/node_modules" "$BUILD/node_modules"
  for d in apps/web packages/ui packages/types packages/api-client; do
    [[ -d "$ROOT/$d/node_modules" ]] && ln -sfn "$ROOT/$d/node_modules" "$BUILD/$d/node_modules"
  done
  (cd "$BUILD" && NODE_OPTIONS=--max-old-space-size=1536 npm run build -w @companio/web)
  rm -rf "$ROOT/apps/web/.next.previous"
  [[ -d "$ROOT/apps/web/.next" ]] && mv "$ROOT/apps/web/.next" "$ROOT/apps/web/.next.previous"
  mv "$BUILD/apps/web/.next" "$ROOT/apps/web/.next"
fi

step "Updating the database schema"
# `prisma db push` refuses changes that would delete data unless told otherwise, so this can't silently drop columns
npm run db:push -w @companio/api -- --skip-generate

step "Encrypting any ID documents stored before encryption was enabled"
npm run kyc:encrypt -w @companio/api

step "Starting the API (and website)"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save >/dev/null

step "Health check"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/meta/health"; then
    printf '\033[1;32mAPI is up on port %s.\033[0m\n' "$PORT"
    if [[ $WEB == 1 ]]; then
      for _ in $(seq 1 60); do
        if curl -fsS -o /dev/null http://127.0.0.1:3001/; then printf '\033[1;32mWebsite is up on port 3001.\033[0m\n'; exit 0; fi
        sleep 1
      done
      echo "Website did not come up. Last log lines:" >&2; pm2 logs companio-web --lines 40 --nostream >&2 || true; exit 1
    fi
    exit 0
  fi
  sleep 1
done
echo "API did not come up. Last log lines:" >&2
pm2 logs companio-api --lines 40 --nostream >&2 || true
exit 1
