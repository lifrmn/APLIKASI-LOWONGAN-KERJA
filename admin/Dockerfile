# =====================================================
# File: admin/Dockerfile
# Fungsi: Production image untuk Admin Dashboard React.
#         Stage 1 build dengan Node, Stage 2 serve via Nginx alpine.
#
# Catatan:
# - Folder `admin/` (source React + package.json) harus sudah ada
#   sebelum image ini di-build.
# - Image hanya men-serve static asset. Reverse-proxy utama (Nginx
#   di service `nginx`) yang menangani SSL & domain.
# =====================================================

# ---------- Stage 1: build ----------
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL bisa di-override pada build time via --build-arg.
ARG VITE_API_URL=https://api.example.com/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ---------- Stage 2: runtime ----------
FROM nginx:1.27-alpine AS runner

# Hapus default config Nginx, pakai konfigurasi SPA kita
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Salin hasil build (Vite default: dist/)
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
