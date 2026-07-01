#!/usr/bin/env bash
# ============================================================
# File: mobile/scripts/generate_keystore.sh
# Fungsi:
#   Generate upload keystore untuk Play App Signing.
#   Output disimpan di mobile/android/key.jks (di-gitignore).
#
# CATATAN PENTING:
#   - JANGAN commit file .jks maupun key.properties ke git.
#   - Simpan password di password manager & backup offline.
#   - Kalau keystore hilang, Anda TIDAK BISA update app di Play
#     Store dengan applicationId yang sama (kecuali via Play App
#     Signing key upgrade — proses manual & terbatas).
# ============================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$DIR/android"
KEYSTORE="$ANDROID_DIR/key.jks"

if ! command -v keytool >/dev/null 2>&1; then
  echo "ERROR: keytool tidak ada di PATH. Install JDK 17+."
  exit 1
fi

if [[ -f "$KEYSTORE" ]]; then
  echo "Keystore sudah ada di $KEYSTORE — dibatalkan."
  exit 1
fi

read -r -p "Alias key (default: upload): " ALIAS
ALIAS="${ALIAS:-upload}"
read -r -p "Nama lengkap (CN, mis. Dinas Tenaga Kerja Sulbar): " CN
read -r -p "Organisasi (O, mis. Pemerintah Provinsi Sulawesi Barat): " ORG
read -r -p "Kota (L, mis. Mamuju): " CITY
read -r -p "Provinsi (ST, mis. Sulawesi Barat): " STATE
read -r -p "Kode negara (C, mis. ID): " COUNTRY

echo
echo "Password keystore dan key HARUS SAMA agar Gradle mudah dikonfigurasi."
echo "Simpan password ini di password manager sekarang juga."
read -r -s -p "Masukkan password (min 6 karakter): " PASS
echo
read -r -s -p "Ulangi password: " PASS2
echo

if [[ "$PASS" != "$PASS2" || ${#PASS} -lt 6 ]]; then
  echo "ERROR: password tidak cocok atau terlalu pendek."
  exit 1
fi

mkdir -p "$ANDROID_DIR"

keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storepass "$PASS" \
  -keypass "$PASS" \
  -dname "CN=$CN, O=$ORG, L=$CITY, ST=$STATE, C=$COUNTRY"

cat > "$ANDROID_DIR/key.properties" <<EOF
storePassword=$PASS
keyPassword=$PASS
keyAlias=$ALIAS
storeFile=key.jks
EOF

echo
echo "SUKSES."
echo "  Keystore  : $KEYSTORE"
echo "  Config    : $ANDROID_DIR/key.properties"
echo
echo "Backup keystore ini SEGERA ke minimal 2 tempat aman."
echo "SHA-1 fingerprint (dibutuhkan bila integrasi Google Sign-In / Play Integrity):"
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PASS" | grep -E 'SHA1|SHA-256'
