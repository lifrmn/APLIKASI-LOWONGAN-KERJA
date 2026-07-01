#!/usr/bin/env bash
# =====================================================
# File: deploy/scripts/update-cf-ips.sh
# Fungsi:
#   Regenerasi file `deploy/nginx/cloudflare-real-ip.conf` dari
#   endpoint resmi Cloudflare. Jalankan via cron mingguan:
#     0 4 * * 1 /opt/sulbar/deploy/scripts/update-cf-ips.sh && nginx -s reload
#
#   Aman untuk dijalankan berulang (idempoten) — file di-write ulang
#   dari template + IP terbaru.
# =====================================================
set -euo pipefail

OUT="$(dirname "$0")/../nginx/cloudflare-real-ip.conf"
TMP="$(mktemp)"

fetch() { curl -fsS --max-time 10 "$1"; }

V4="$(fetch https://www.cloudflare.com/ips-v4/)"
V6="$(fetch https://www.cloudflare.com/ips-v6/)"

{
  echo "# AUTO-GENERATED oleh update-cf-ips.sh — JANGAN diedit manual."
  echo "# Regenerate: bash deploy/scripts/update-cf-ips.sh"
  echo
  echo "$V4" | awk 'NF{print "set_real_ip_from " $1 ";"}'
  echo
  echo "$V6" | awk 'NF{print "set_real_ip_from " $1 ";"}'
  echo
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > "$TMP"

mv "$TMP" "$OUT"
echo "Updated: $OUT"
