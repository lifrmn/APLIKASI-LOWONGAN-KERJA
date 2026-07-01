# Aset ikon aplikasi

Letakkan file berikut di folder ini (buat manual pakai desainer/Figma):

| Nama file | Ukuran | Format | Keterangan |
|---|---|---|---|
| `app_icon.png` | 1024 x 1024 px | PNG (RGBA, no transparency di bagian tengah) | Ikon utama Play Store & launcher iOS |
| `app_icon_foreground.png` | 1024 x 1024 px | PNG transparan | Adaptive icon Android (background solid `#0F5CAB` di-generate otomatis) |

Setelah kedua file tersedia, jalankan:

```bash
cd mobile
dart run flutter_launcher_icons
```

Akan meng-generate:
- `android/app/src/main/res/mipmap-*/launcher_icon.png`
- `android/app/src/main/res/mipmap-anydpi-v26/launcher_icon.xml` (adaptive)
- `ios/Runner/Assets.xcassets/AppIcon.appiconset/...`

Terakhir set icon di `AndroidManifest.xml`: `android:icon="@mipmap/launcher_icon"`
