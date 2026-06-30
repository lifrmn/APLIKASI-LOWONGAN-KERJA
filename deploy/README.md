# Panduan Deploy ke VPS Ubuntu — Bursa Kerja Digital

Panduan ini menjelaskan langkah-langkah deploy aplikasi (backend NestJS + admin React) ke VPS Ubuntu menggunakan Docker Compose, Nginx, dan SSL Let's Encrypt.

---

## 1. Prasyarat

- VPS Ubuntu 22.04/24.04 (≥ 2 vCPU, 2 GB RAM, 30 GB disk).
- 2 record DNS A diarahkan ke IP server:
  - `api.example.com` → IP VPS
  - `admin.example.com` → IP VPS
- User non-root dengan akses sudo (mis. `deploy`).
- Akses SSH (port 22 atau custom).

---

## 2. Persiapan server (sekali saja)

```bash
# Login ke server
ssh deploy@your-vps-ip

# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Docker Engine + Compose plugin (resmi)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Tambah user ke group docker (logout/login setelahnya)
sudo usermod -aG docker $USER

# Install certbot (host-level, akan menyimpan cert di /etc/letsencrypt)
sudo apt install -y certbot

# Firewall UFW: hanya 22, 80, 443
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# (Opsional) fail2ban untuk SSH brute force
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## 3. Clone project & siapkan env

```bash
sudo mkdir -p /opt/bursa-kerja
sudo chown $USER:$USER /opt/bursa-kerja
cd /opt/bursa-kerja

# Clone repository
git clone https://github.com/lifrmn/APLIKASI-LOWONGAN-KERJA.git .

# Siapkan env production
cp deploy/.env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Isi nilai `.env.production`:

```bash
# Generate secret kuat:
openssl rand -base64 32   # POSTGRES_PASSWORD, REDIS_PASSWORD
openssl rand -base64 64   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
```

Ganti `api.example.com` & `admin.example.com` di:
- `deploy/nginx/api.conf`
- `deploy/nginx/admin.conf`
- `.env.production` (`CORS_ORIGINS`, `APP_URL`, `VITE_API_URL`)

---

## 4. Terbitkan SSL Let's Encrypt

Saat pertama kali, container `nginx` perlu cert agar bisa start. Strategi paling sederhana:

```bash
# Stop dulu service yang dengar port 80 (apache lama, dll). Pastikan kosong.
sudo lsof -i:80

# Buat cert untuk kedua subdomain dengan certbot standalone
sudo certbot certonly --standalone --agree-tos -m admin@example.com -d api.example.com
sudo certbot certonly --standalone --agree-tos -m admin@example.com -d admin.example.com

# Auto-renew tiap 12 jam (timer systemd certbot sudah otomatis aktif)
sudo systemctl status certbot.timer
```

Cert disimpan di `/etc/letsencrypt/live/<domain>/` yang sudah di-mount read-only ke container nginx (lihat `docker-compose.prod.yml`).

> Setelah ada cert, restart nginx untuk reload:  
> `docker compose -f deploy/docker-compose.prod.yml --env-file .env.production restart nginx`

---

## 5. Build & jalankan stack

```bash
cd /opt/bursa-kerja

# Buat folder backup
mkdir -p backups

# Build + start semua service di background
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build

# Lihat status & log
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production ps
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production logs -f backend
```

Verifikasi:
- `curl -I https://api.example.com/api/v1/health` (jika HealthModule aktif)
- `curl -I https://admin.example.com`

---

## 6. Migrasi & seed

Container backend otomatis menjalankan `prisma migrate deploy` saat start (lihat `CMD` di `backend/Dockerfile`). Untuk seed manual:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production exec backend \
  npx prisma db seed
```

---

## 7. Backup harian otomatis

```bash
# Test manual dulu
bash deploy/scripts/backup-db.sh
ls -lh backups/

# Aktifkan cron tiap hari pukul 02:00
crontab -e
```

Tambahkan baris:
```cron
0 2 * * * cd /opt/bursa-kerja && /usr/bin/bash deploy/scripts/backup-db.sh >> /var/log/bk-backup.log 2>&1
```

Restore (hati-hati — menulis ulang DB):
```bash
bash deploy/scripts/restore-db.sh backups/db-bursa_kerja-20260630-020000Z.sql.gz
```

---

## 8. CI/CD otomatis via GitHub Actions

Set repository secrets di GitHub → Settings → Secrets and variables:

| Secret | Contoh |
|---|---|
| `SSH_HOST` | `1.2.3.4` |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22` |
| `SSH_PRIVATE_KEY` | private key OpenSSH (multiline) |
| `VPS_PROJECT_DIR` | `/opt/bursa-kerja` |
| `VITE_API_URL` | `https://api.example.com/api/v1` |

Setiap push ke `main`:
1. Lint & type check & build backend
2. Build admin (skip jika `admin/` belum dibuat)
3. SSH ke VPS, jalankan `deploy/scripts/deploy.sh`

---

## 9. Update aplikasi (manual)

```bash
cd /opt/bursa-kerja
bash deploy/scripts/deploy.sh
```

Script: git pull → docker build → up -d → prisma migrate deploy → prune image lama.

---

## 10. Keamanan production — checklist

- [x] `.env.production` permission `600`, owner non-root, tidak masuk git.
- [x] Password DB & Redis ≥ 32 karakter random.
- [x] JWT secrets ≥ 64 karakter random.
- [x] Postgres & Redis tidak meng-expose port ke host (lihat compose — tanpa `ports:`).
- [x] Hanya nginx yang publik (80/443). UFW menutup port lain.
- [x] HSTS aktif (`Strict-Transport-Security`).
- [x] Security headers di nginx (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- [x] Rate limit nginx (`api_limit zone`) + throttle level aplikasi.
- [x] Upload size dibatasi (`client_max_body_size 10M`).
- [x] WebSocket diizinkan hanya pada `/socket.io/`.
- [x] Volume `uploads_data` terisolasi.
- [x] Cert auto-renew via certbot timer.
- [x] Backup harian + rotasi 14 hari.
- [x] fail2ban aktif untuk SSH.
- [ ] **Matikan Swagger di publik (`SWAGGER_ENABLED=false`)** untuk production.
- [ ] Setup monitoring log (`docker compose logs` → file rotasi, atau pipe ke Loki/Grafana).

---

## 11. Troubleshooting cepat

| Masalah | Cek |
|---|---|
| Container backend tidak start | `docker compose logs backend` |
| Migrasi gagal | masuk container: `docker compose exec backend sh` → `npx prisma migrate status` |
| Cert tidak diakui | `sudo certbot certificates`; pastikan path mount benar |
| 502 Bad Gateway | service backend down, lihat log |
| Upload >10MB ditolak | naikkan `client_max_body_size` di `nginx.conf` + `UPLOAD_MAX_FILE_SIZE_MB` di env |
| WebSocket gagal | pastikan client connect ke `wss://api.example.com/socket.io/...` (path harus cocok dengan namespace `/chat`) |
