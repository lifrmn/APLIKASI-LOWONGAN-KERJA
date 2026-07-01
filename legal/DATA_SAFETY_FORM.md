# Google Play Data Safety Form — Jawaban Rujukan

Gunakan jawaban di bawah saat mengisi **Data Safety** di Play Console
(Menu: **Policy & programs → App content → Data safety**).
Sesuaikan bila fitur berubah.

---

## Overview

| Pertanyaan | Jawaban |
|---|---|
| Apakah aplikasi mengumpulkan atau membagikan data pengguna? | **Yes, collects; Yes, shares** (dibagikan ke perusahaan yang Anda lamar) |
| Apakah data ditransmisi dienkripsi? | **Yes** (TLS/HTTPS) |
| Apakah pengguna bisa meminta penghapusan data? | **Yes** — kontak in-app + email `support@sulbarkerja.id` |
| Apakah menerapkan kebijakan privasi? | **Yes** — https://sulbarkerja.id/legal/privacy |
| Kepatuhan pada kebijakan Families? | **No** (aplikasi bukan untuk anak <13) |
| Independent security review? | **No** (di MVP; ditambahkan setelah audit) |

---

## Data types — mark **Collected** & **Shared** sesuai berikut

### Personal info
- **Name** — Collected. Shared (dengan perusahaan yang dilamar). Optional. Purpose: Account management, App functionality.
- **Email address** — Collected. Not shared publicly. Required. Purpose: Account management, Communication.
- **User IDs** (internal UUID) — Collected. Not shared. Required. Purpose: App functionality.
- **Address** — Collected (opsional). Shared (dengan perusahaan yang dilamar). Purpose: App functionality.
- **Phone number** — Collected (opsional). Shared (dengan perusahaan yang dilamar). Purpose: Account management, Communication.
- **Race and ethnicity** — Not collected.
- **Political or religious beliefs** — Not collected.
- **Sexual orientation** — Not collected.
- **Other info (Gender, DOB)** — Collected (opsional). Shared (dengan perusahaan yang dilamar). Purpose: App functionality.

### Financial info
- **Salary preferences (expectedSalary)** — Collected. Shared (dengan perusahaan yang dilamar). Optional. Purpose: App functionality.
- **User payment info** — Not collected.

### Health & fitness — **Not collected**.

### Messages
- **Emails** — Not collected as data (hanya alamat email untuk komunikasi).
- **SMS / MMS** — Not collected.
- **Other in-app messages (chat HRD ↔ pencari kerja)** — Collected. Not shared. Purpose: App functionality (chat lamaran). Optional.

### Photos & videos
- **Photos** — Collected (foto profil, foto e-KTP opsional). Not shared publicly. Purpose: App functionality, Identity verification. Optional.

### Audio files — **Not collected**.

### Files & docs
- **Files & docs** — Collected (CV, sertifikat, portofolio, dokumen legalitas perusahaan). Shared (CV dengan perusahaan yang dilamar). Purpose: App functionality. Optional.

### Calendar — **Not collected**.
### Contacts — **Not collected**.

### App activity
- **App interactions** — Collected. Not shared. Purpose: Analytics (agregat), App functionality, Fraud prevention.
- **In-app search history** — Collected. Not shared. Purpose: App functionality.
- **Installed apps** — Not collected.
- **Other user-generated content** (lamaran, ulasan) — Collected. Shared (dengan perusahaan yang dilamar). Purpose: App functionality. Optional.

### Web browsing — **Not collected**.

### App info & performance
- **Crash logs** — Collected. Not shared. Purpose: Analytics, App functionality.
- **Diagnostics** — Collected. Not shared. Purpose: App functionality.
- **Other app performance data** — Not collected.

### Device or other IDs
- **Device or other IDs** — Collected (internal session/refresh token id). Not shared. Purpose: Fraud prevention/security, App functionality.

### Location
- **Approximate location** — Not collected by default. Optional bila fitur "cari kerja di sekitar saya" digunakan.
- **Precise location** — Not collected.

### **Identity documents (KTP/NIK)** — kategori khusus:
Data ini masuk kategori **Personal info → Other info** karena Play Data Safety tidak punya field spesifik "national ID". Cantumkan di bagian *Data used*:
- Collected: **Yes**, optional (untuk verifikasi identitas).
- Shared: **No** (tidak dibagikan ke perusahaan; hanya admin berwenang).
- Purpose: **Account management** (identity verification).
- Justifikasi tambahan: NIK di-mask di seluruh response; e-KTP disimpan encrypted-at-rest, hanya diakses admin dengan permission khusus & dicatat pada audit log.

---

## Security practices (bagian bawah form)

| Praktik | Jawaban |
|---|---|
| Data in transit encrypted | **Yes** (TLS 1.2+) |
| Data deletion mechanism | **Yes** (in-app + email request) |
| Follows Play Families Policy | **No** |
| Committed to Play [Data safety practices](https://developer.android.com/quality/privacy-and-security) | **Yes** |
| Independent security review | **No** (planned setelah audit tahun 1) |

---

## URL yang harus diisi Play Console

- **Privacy policy URL**: `https://sulbarkerja.id/legal/privacy`
- **App category**: `Business` (subcategory: Jobs)
- **Target audience & content**: 15+ (Teen)
- **Ads**: **No** (aplikasi pemerintah, tanpa iklan)
- **Government app declaration**: **Yes** — pilih "Government agency" saat setup akun developer, siapkan surat resmi dari Disnaker Sulbar sebagai bukti.

---

## Catatan Penting

1. **Pertanyaan Sensitive/Financial**: hindari mengklaim sebagai `Financial info` — gaji harapan dianggap "salary preferences" bukan payment. Aman.
2. **Verifikasi Government account**: Play Console memberikan lencana "Government" bila dokumen terverifikasi — direkomendasikan untuk kredibilitas.
3. **e-KTP bukan biometrik**. Jangan aktifkan flag "Biometric data" bila hanya menyimpan foto KTP; itu masuk `Photos`.
4. **Chat message**: bila nanti diaktifkan enkripsi end-to-end, ubah jawaban Encryption in transit → dan tambahkan "Messages encrypted end-to-end".
5. Setelah setiap **rilis** yang mengubah data flow, WAJIB update form Data Safety sebelum submit ke Play Review.
