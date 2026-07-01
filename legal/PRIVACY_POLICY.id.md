# Kebijakan Privasi — Sulbar Kerja

**Efektif sejak:** 1 Juli 2026
**Pengelola:** Dinas Tenaga Kerja Provinsi Sulawesi Barat (Disnaker Sulbar)
**Kontak:** support@sulbarkerja.id · Jl. ... (alamat resmi), Mamuju
**DPO / Petugas Perlindungan Data:** dpo@sulbarkerja.id

Aplikasi **Sulbar Kerja** ("Aplikasi") adalah platform bursa kerja digital resmi milik Pemerintah Provinsi Sulawesi Barat. Kebijakan ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

---

## 1. Data yang Kami Kumpulkan

**A. Data akun & profil (Anda berikan):**
- Nama lengkap, email, nomor HP, password (di-hash), username (opsional).
- Foto profil (opsional).

**B. Data profil pencari kerja (opsional):**
- NIK (opsional pada MVP, disimpan ter-mask), tempat & tanggal lahir, jenis kelamin, alamat, wilayah (provinsi/kabupaten/kecamatan/desa).
- Riwayat pendidikan, pengalaman kerja, skill, sertifikat, portofolio.
- CV, foto identitas, foto e-KTP (opsional untuk verifikasi identitas).

**C. Data perusahaan (untuk akun `COMPANY`/`HRD`):**
- Nama perusahaan, bidang usaha, email, telepon, alamat, logo, dokumen legalitas.

**D. Data lamaran & aktivitas:**
- Riwayat melamar, status lamaran, pesan chat dengan HRD.

**E. Data teknis (otomatis):**
- Alamat IP, User-Agent, informasi perangkat dasar (OS, versi aplikasi).
- Log audit (login, aksi sensitif).

Kami **tidak** mengumpulkan lokasi GPS presisi tanpa izin eksplisit Anda.

---

## 2. Tujuan Penggunaan Data

1. Menyediakan layanan bursa kerja: mencocokkan pencari kerja dengan lowongan.
2. Verifikasi identitas & perusahaan (untuk mencegah penipuan lowongan).
3. Statistik kebijakan ketenagakerjaan agregat (tidak mengidentifikasi individu).
4. Notifikasi status lamaran, undangan interview, pengumuman.
5. Keamanan (deteksi login mencurigakan, rate-limit, audit).
6. Kewajiban hukum (misal: permintaan resmi aparat penegak hukum).

Kami **tidak** menjual data pribadi Anda.

---

## 3. Dasar Hukum Pemrosesan

- **Persetujuan** Anda saat mendaftar (Pasal 20 huruf a UU PDP).
- **Pelaksanaan tugas pemerintahan** oleh Disnaker Sulbar (Pasal 20 huruf f UU PDP).
- **Kewajiban hukum** tertentu (Pasal 20 huruf c UU PDP).

---

## 4. Pihak Ketiga

Data dapat dibagikan kepada:
- **Perusahaan pemberi kerja** — hanya data yang relevan dengan lamaran yang Anda kirim (nama, kontak, CV, skill).
- **Penyedia infrastruktur** — hosting cloud, layanan email transaksional. Diikat perjanjian pemrosesan data (DPA).
- **Aparat berwenang** — bila diperintahkan berdasarkan proses hukum yang sah.

Kami **tidak** mengirim data Anda ke pengiklan atau broker data.

---

## 5. Data Sensitif — NIK & e-KTP

- Upload e-KTP **bersifat opsional**.
- NIK ditampilkan ter-**masking** (mis. `7604********0001`) kecuali kepada pemilik dan admin yang memiliki izin khusus (`sensitive.identity.read`).
- Berkas e-KTP disimpan **tidak public** dan hanya bisa diunduh via endpoint terautentikasi + audit log.
- Setiap akses admin ke data sensitif dicatat pada audit log.

---

## 6. Retensi Data

| Jenis data | Retensi |
|---|---|
| Akun aktif | Selama akun aktif |
| Akun tidak aktif > 24 bulan | Anonimisasi otomatis |
| Data lamaran | Minimal 3 tahun (kepentingan statistik & hukum) |
| Audit log | Minimal 2 tahun |
| Berkas e-KTP | 12 bulan setelah verifikasi terakhir, kecuali diminta hapus lebih cepat |

Anda dapat meminta penghapusan lebih awal melalui prosedur di bagian 8.

---

## 7. Keamanan

- Password di-hash (bcrypt).
- Komunikasi via HTTPS/TLS.
- Refresh token disimpan sebagai hash & di-rotasi (family-based).
- File sensitif tidak dapat diakses via URL publik.
- Rate limiting & audit log terhadap akses data sensitif.
- Prinsip **least privilege**: role admin dibatasi hanya untuk data yang menjadi kewenangan wilayahnya.

Tidak ada sistem yang 100% aman. Kami berkomitmen memberitahu Anda dalam **72 jam** apabila terjadi insiden yang berdampak pada data pribadi Anda, sesuai UU PDP.

---

## 8. Hak Anda

Sesuai UU PDP, Anda berhak untuk:
- Mengakses & meminta salinan data Anda.
- Memperbarui / mengoreksi data yang tidak akurat.
- Menghapus akun & data (kecuali data yang harus disimpan berdasarkan hukum).
- Menarik persetujuan pemrosesan (pemrosesan berhenti untuk pemakaian yang berbasis persetujuan).
- Membatasi atau menolak pemrosesan tertentu.
- Portabilitas data (menerima salinan dalam format terstruktur).
- Mengajukan keluhan ke lembaga pengawas PDP.

Permintaan dikirim ke **support@sulbarkerja.id**. Kami merespon paling lambat **14 hari kerja**.

---

## 9. Anak di Bawah Umur

Aplikasi ditujukan untuk usia **15 tahun ke atas** (usia kerja menurut BPS Indonesia). Jika Anda di bawah 15 tahun, jangan gunakan aplikasi ini tanpa pendampingan orang tua/wali.

---

## 10. Perubahan Kebijakan

Kebijakan ini dapat diperbarui. Perubahan material akan diberitahukan via notifikasi in-app dan/atau email minimal 7 hari sebelum berlaku.

---

## 11. Kontak

- **Email:** support@sulbarkerja.id
- **DPO:** dpo@sulbarkerja.id
- **Alamat:** Kantor Dinas Tenaga Kerja Provinsi Sulawesi Barat, Mamuju.
