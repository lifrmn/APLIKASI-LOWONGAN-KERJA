# Sulbar Kerja — Mobile (Flutter)

Skeleton siap-Play-Store untuk aplikasi mobile **Sulbar Kerja**.

## Prasyarat

- Flutter SDK **3.24+** (`flutter --version`)
- Android Studio + Android SDK **34** (untuk `flutter build appbundle`)
- Xcode 15+ (opsional, hanya jika ingin build iOS)
- JDK 17 (`keytool` untuk signing)

## Inisialisasi

```bash
bash mobile/scripts/init.sh
```

Script ini menjalankan `flutter create` dengan:
- `--org id.go.sulbar`
- `--project-name sulbar_kerja`
- `--platforms android,ios`

Lalu me-restore file kustom (`pubspec.yaml`, `.gitignore`, dsb.) dan `flutter pub get`.

## Konfigurasi

1. Copy `.env.example` ke `.env` — set `API_BASE_URL` yang sesuai (dev/staging/prod).
2. Letakkan ikon di `assets/icon/app_icon.png` (1024×1024).
3. Letakkan splash di `assets/splash/splash_logo.png` (1152×1152).
4. Generate ikon & splash:
   ```bash
   dart run flutter_launcher_icons
   dart run flutter_native_splash:create
   ```
5. Set icon di `android/app/src/main/AndroidManifest.xml` → `android:icon="@mipmap/launcher_icon"`.

## Signing Release

```bash
bash mobile/scripts/generate_keystore.sh
```

Interaktif; menghasilkan `android/key.jks` + `android/key.properties` (keduanya di-gitignore).

Kemudian **merge** isi [android/app/build.gradle.signing.snippet](android/app/build.gradle.signing.snippet) ke `android/app/build.gradle` (Groovy) hasil `flutter create`. Perhatikan:
- `applicationId = "id.go.sulbar.kerja"` (final; tidak bisa diubah setelah rilis)
- `minSdk = 23`, `targetSdk = 34`
- Blok `signingConfigs.release` membaca dari `key.properties`
- `minifyEnabled true` + `shrinkResources true` dengan `proguard-rules.pro`

## Build .aab

```bash
bash mobile/scripts/build_release.sh
# Output: build/app/outputs/bundle/release/app-release.aab
```

## Upload ke Play Console

1. Buat akun **Google Play Console** (**USD 25** one-time; pilih **Organization → Government** jika didaftarkan sebagai instansi).
2. Buat aplikasi baru, isi **App details** (nama, deskripsi, screenshots, feature graphic 1024×500).
3. **App content**:
   - Privacy Policy URL: `https://sulbarkerja.id/legal/privacy`
   - Data Safety: ikuti [legal/DATA_SAFETY_FORM.md](../legal/DATA_SAFETY_FORM.md)
   - Ads: **No**
   - Content rating: isi kuesioner (biasanya PEGI 3 / Everyone)
   - Target audience: **15+**
   - Government app declaration: **Yes** (siapkan surat resmi Disnaker Sulbar)
4. **Release → Production → Create new release**, upload `.aab`, isi release notes.
5. Kirim untuk review (biasanya 3–7 hari kerja).

## CI (GitHub Actions)

Workflow: [`.github/workflows/mobile-android-build.yml`](../.github/workflows/mobile-android-build.yml)
Trigger: `workflow_dispatch` atau tag `mobile-v*.*.*`.
Butuh **secrets**:

| Secret | Isi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 mobile/android/key.jks` |
| `ANDROID_STORE_PASSWORD` | password keystore |
| `ANDROID_KEY_PASSWORD` | password key alias |
| `ANDROID_KEY_ALIAS` | mis. `upload` |

Dan **variable** `API_BASE_URL` (produksi). Artifact `.aab` bisa langsung diunduh dari halaman workflow.

## Struktur Folder

```
mobile/
├── .env.example
├── .gitignore
├── analysis_options.yaml
├── pubspec.yaml
├── android/
│   ├── key.properties.example
│   └── app/
│       ├── build.gradle.signing.snippet   ← merge ke build.gradle asli
│       └── proguard-rules.pro
├── assets/
│   ├── icon/        (README + ikon 1024x1024)
│   └── splash/      (README + logo splash)
└── scripts/
    ├── init.sh                 (flutter create + restore kustom)
    ├── generate_keystore.sh    (buat key.jks interaktif)
    └── build_release.sh        (build .aab)
```

## Checklist Play Store

- [ ] `flutter create` sudah dijalankan (`android/`, `ios/`, `lib/main.dart` ada)
- [ ] Ikon & splash sudah di-generate
- [ ] `applicationId` = `id.go.sulbar.kerja`
- [ ] `versionCode`/`versionName` di `pubspec.yaml` diperbarui
- [ ] `key.jks` di-backup di 2 tempat aman
- [ ] `.aab` berhasil di-build
- [ ] Privacy policy hosted (`sulbarkerja.id/legal/privacy`)
- [ ] Data safety form terisi
- [ ] Screenshot ≥ 2 (min. 320px, max. 3840px, rasio 16:9 atau 9:16)
- [ ] Feature graphic 1024×500 PNG
- [ ] Akun Play Console terverifikasi sebagai Government
- [ ] Content rating & target audience terisi
- [ ] `SHA-256` fingerprint dari Play App Signing didaftarkan (kalau butuh Google Sign-In / Play Integrity)

## Lisensi

Milik Pemerintah Provinsi Sulawesi Barat. Semua hak dilindungi.
