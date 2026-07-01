# Aset splash screen

Letakkan:

| Nama | Ukuran | Format | Keterangan |
|---|---|---|---|
| `splash_logo.png` | 1152 x 1152 px | PNG transparan | Logo utama, di-render di tengah layar |
| `splash_logo_android12.png` | 1152 x 1152 px | PNG transparan | Wajib untuk Android 12+ (splash API baru) |

Setelah tersedia, jalankan:

```bash
cd mobile
dart run flutter_native_splash:create
```

Warna background diambil dari `pubspec.yaml` → `flutter_native_splash.color` (`#0F5CAB`).
