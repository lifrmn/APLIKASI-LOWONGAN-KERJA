#!/usr/bin/env bash
# =====================================================
# File: deploy/scripts/deploy.sh
# Fungsi: One-shot deploy di server:
#   1. Pull source terbaru.
#   2. Build image backend & admin.
#   3. Recreate container dengan zero-restart untuk yang tidak berubah.
#   4. Jalankan migrasi Prisma.
#   5. Cleanup image lama.
#
# Cara pakai (di server, sebagai user yang tergabung di docker group):
#   cd /opt/bursa-kerja
#   bash deploy/scripts/deploy.sh
#
# Dipanggil juga oleh GitHub Actions via SSH.
# =====================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/.env.production"
BRANCH="${BRANCH:-main}"

cd "${ROOT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} tidak ditemukan di server." >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] === Deploy mulai (branch=${BRANCH}) ==="

# 1. Update source
git fetch --all --prune
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

# 2. Build (Compose akan re-build image yang berubah)
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build --pull

# 3. Recreate container (start hanya yang berubah)
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

# 4. Migrasi (idempotent, sudah dipanggil otomatis di CMD container,
#    tapi diulang di sini untuk eksplisit & cepat fail jika bermasalah).
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend \
  npx prisma migrate deploy

# 5. Cleanup image lama
docker image prune -f

echo "[$(date -u +%FT%TZ)] === Deploy selesai ==="
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
