#!/usr/bin/env bash
# Backs up the SQLite database (a consistent online copy) and the uploads folder, keeping 14 days.
# Runs daily from cron (installed by setup-server.sh) and before every deploy.
#   Optional: set BACKUP_REMOTE (an rclone remote, e.g. "r2:companio-backups") to also copy backups off the server —
#   a backup that only lives on the same disk won't survive losing the server.
set -euo pipefail

DATA="${COMPANIO_DATA:-/srv/companio-data}"
DB="$DATA/companio.db"
OUT="$DATA/backups"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"
mkdir -p "$OUT"

if [[ -f "$DB" ]]; then
  # .backup is safe while the API is running (unlike copying the file)
  sqlite3 "$DB" ".backup '$OUT/companio-$STAMP.db'"
  gzip -f "$OUT/companio-$STAMP.db"
  echo "$(date "+%F %T") database → $OUT/companio-$STAMP.db.gz"
else
  echo "$(date "+%F %T") no database yet at $DB — skipping"
fi

if [[ -d "$DATA/uploads" ]]; then
  tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$DATA" uploads
  echo "$(date "+%F %T") uploads  → $OUT/uploads-$STAMP.tar.gz"
fi

find "$OUT" -maxdepth 1 \( -name 'companio-*.db.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

if [[ -n "${BACKUP_REMOTE:-}" ]] && command -v rclone >/dev/null; then
  rclone copy "$OUT" "$BACKUP_REMOTE" --include 'companio-*.db.gz' --include 'uploads-*.tar.gz'
  echo "$(date "+%F %T") copied to $BACKUP_REMOTE"
fi
