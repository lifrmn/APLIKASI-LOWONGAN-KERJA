#!/usr/bin/env bash
# ============================================================
# File: mobile/scripts/init.sh
# Fungsi:
#   Inisialisasi project Flutter di folder mobile/. Karena
#   `flutter create` menghasilkan file native (android/, ios/, dst)
#   yang tidak bisa dibuat manual, script ini menjalankan
#   `flutter create` lalu me-restore file kustom (pubspec.yaml,
#   analysis_options.yaml, dsb.) yang sudah kami commit di repo.
#
# Prasyarat:
#   - Flutter SDK terinstall (>= 3.22)
#   - `flutter doctor` OK
#
# Jalankan (dari root repo):
#   bash mobile/scripts/init.sh
# ============================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

ORG="id.go.sulbar"
PROJECT_NAME="sulbar_kerja"

if ! command -v flutter >/dev/null 2>&1; then
  echo "ERROR: flutter tidak ditemukan di PATH. Install Flutter SDK dulu."
  exit 1
fi

echo "==> Backup file kustom repo"
mkdir -p .tmp_backup
for f in pubspec.yaml analysis_options.yaml .gitignore .env.example; do
  [[ -f "$f" ]] && cp "$f" ".tmp_backup/$f"
done

echo "==> Menjalankan flutter create"
flutter create \
  --org "$ORG" \
  --project-name "$PROJECT_NAME" \
  --platforms=android,ios \
  --description "Sulbar Kerja - Aplikasi Bursa Kerja Digital" \
  .

echo "==> Restore file kustom"
for f in pubspec.yaml analysis_options.yaml .gitignore .env.example; do
  [[ -f ".tmp_backup/$f" ]] && cp ".tmp_backup/$f" "$f"
done
rm -rf .tmp_backup

echo "==> flutter pub get"
flutter pub get

echo
echo "SELESAI. Langkah berikutnya:"
echo "  1) Copy .env.example ke .env dan sesuaikan API_BASE_URL"
echo "  2) Letakkan assets/icon/app_icon.png (1024x1024) & assets/splash/splash_logo.png"
echo "  3) dart run flutter_launcher_icons"
echo "  4) dart run flutter_native_splash:create"
echo "  5) bash mobile/scripts/generate_keystore.sh   # buat keystore rilis"
echo "  6) bash mobile/scripts/build_release.sh       # build .aab"
