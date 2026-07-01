# Sulbar Kerja — Admin Dashboard (React + Vite)

## Prasyarat
- Node.js 20+
- Backend Sulbar Kerja berjalan di `VITE_API_URL`

## Setup

```bash
cd admin
cp .env.example .env      # sesuaikan VITE_API_URL
npm install
npm run dev               # -> http://localhost:5173
```

Login pakai akun **SUPER_ADMIN** yang dibuat oleh seeder backend
(default: `admin@sulbarkerja.id` / `SulbarKerja!2026`).

## Build produksi

```bash
npm run build       # output ke dist/
npm run preview     # serve dist/ untuk uji lokal
```

## Docker

Dockerfile yang sudah ada ([`Dockerfile`](Dockerfile)) mem-build dengan
`--build-arg VITE_API_URL=https://api.example.com/api/v1` lalu serve
lewat Nginx.

```bash
docker build --build-arg VITE_API_URL=https://api.sulbarkerja.id/api/v1 -t sulbar-kerja-admin .
docker run --rm -p 8080:80 sulbar-kerja-admin
```

## Struktur

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── lib/
│   ├── api.ts            axios + refresh-token interceptor
│   ├── auth.ts           zustand store (persist)
│   ├── queryClient.ts    TanStack Query defaults
│   └── format.ts         formatter tanggal / mata uang
├── components/
│   ├── Layout.tsx
│   ├── ProtectedRoute.tsx
│   ├── Pagination.tsx
│   └── StatusBadge.tsx
└── pages/
    ├── LoginPage.tsx
    ├── DashboardPage.tsx
    ├── UsersPage.tsx
    ├── CompaniesPage.tsx  (verify/reject action)
    ├── JobsPage.tsx
    ├── ApplicationsPage.tsx
    └── AuditLogPage.tsx
```

## Fitur

- Login + refresh-token otomatis (axios interceptor)
- RBAC gate: hanya role admin/leader/operator yang boleh masuk
- Dashboard ringkasan
- User list (search + pagination)
- Perusahaan (filter status + verify/reject action)
- Lowongan (filter status)
- Lamaran (filter status)
- Audit log (filter module + action)
