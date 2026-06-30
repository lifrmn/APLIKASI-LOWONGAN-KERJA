#!/usr/bin/env bash
# =====================================================
# File: deploy/scripts/restore-db.sh
# Fungsi: Restore database dari file backup gzip.
#         Memerlukan konfirmasi interaktif (kecuali --force).
#
# Cara pakai:
#   bash deploy/scripts/restore-db.sh /path/db-backup.sql.gz
#   bash deploy/scripts/restore-db.sh /path/db-backup.sql.gz --force
# =====================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz> [--force]" >&2
  exit 1
fi

BACKUP_FILE="$1"
FORCE="${2:-}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: File ${BACKUP_FILE} tidak ditemukan." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} tidak ditemukan." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

echo "AKAN DITULIS ULANG: database ${POSTGRES_DB} dari ${BACKUP_FILE}"
if [[ "${FORCE}" != "--force" ]]; then
  read -r -p "Ketik 'YES' untuk melanjutkan: " ans
  [[ "${ans}" == "YES" ]] || { echo "Dibatalkan."; exit 1; }
fi

echo "[$(date -u +%FT%TZ)] Mulai restore..."

gunzip -c "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1

echo "[$(date -u +%FT%TZ)] Restore selesai."
