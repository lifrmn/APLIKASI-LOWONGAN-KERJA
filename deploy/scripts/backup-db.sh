#!/usr/bin/env bash
# =====================================================
# File: deploy/scripts/backup-db.sh
# Fungsi: Backup database PostgreSQL ke folder backups/ dengan
#         nama berstempel waktu. Otomatis hapus backup lebih dari
#         RETENTION_DAYS hari (default 14).
#
# Cara pakai (manual):
#   bash deploy/scripts/backup-db.sh
#
# Cron job (harian 02:00):
#   0 2 * * * cd /opt/bursa-kerja && /usr/bin/bash deploy/scripts/backup-db.sh >> /var/log/bk-backup.log 2>&1
# =====================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/.env.production"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} tidak ditemukan." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="${BACKUP_DIR}/db-${POSTGRES_DB}-${TIMESTAMP}.sql.gz"

echo "[$(date -u +%FT%TZ)] Mulai backup → ${OUT}"

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists \
  | gzip -9 > "${OUT}"

# Verifikasi file tidak kosong
if [[ ! -s "${OUT}" ]]; then
  echo "ERROR: File backup kosong. Dihapus." >&2
  rm -f "${OUT}"
  exit 2
fi

# Rotasi: hapus backup lama
find "${BACKUP_DIR}" -name "db-${POSTGRES_DB}-*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] Selesai. Ukuran: $(du -h "${OUT}" | cut -f1)"
