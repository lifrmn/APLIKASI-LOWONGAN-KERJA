#!/usr/bin/env bash
# ============================================================
# File: mobile/scripts/build_release.sh
# Fungsi:
#   Build release .aab (Android App Bundle) untuk Play Store.
#   Output: mobile/build/app/outputs/bundle/release/app-release.aab
# ============================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [[ ! -f "android/key.properties" || ! -f "android/key.jks" ]]; then
  echo "ERROR: keystore belum di-generate. Jalankan: bash mobile/scripts/generate_keystore.sh"
  exit 1
fi

flutter --version
flutter pub get
flutter clean
flutter build appbundle --release --dart-define=APP_ENV=production

OUT="build/app/outputs/bundle/release/app-release.aab"
if [[ -f "$OUT" ]]; then
  echo
  echo "SUKSES: $DIR/$OUT"
  ls -lh "$OUT"
else
  echo "GAGAL: file .aab tidak ditemukan."
  exit 1
fi
