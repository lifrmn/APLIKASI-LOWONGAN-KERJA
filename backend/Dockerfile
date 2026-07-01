# =====================================================
# File: backend/Dockerfile
# Fungsi: Production image untuk backend NestJS.
#         Multi-stage build agar image runtime kecil & hanya
#         berisi dist + node_modules production + prisma client.
# =====================================================

# ---------- Stage 1: build ----------
FROM node:26-alpine AS builder

WORKDIR /app

# Salin manifest & schema dulu (cache layer)
COPY package*.json ./
COPY prisma ./prisma

# Install seluruh dependency (dev + prod) untuk build
RUN npm ci

# Generate Prisma Client untuk target Alpine (musl)
RUN npx prisma generate

# Salin sisa source code
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build TypeScript → dist
RUN npm run build

# Buang dev deps agar bisa salin node_modules prod-only ke runner
RUN npm prune --omit=dev


# ---------- Stage 2: runtime ----------
FROM node:26-alpine AS runner

# tini untuk PID 1 yang proper (graceful shutdown)
RUN apk add --no-cache tini

WORKDIR /app
ENV NODE_ENV=production

# User non-root untuk keamanan
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nestjs:nodejs --from=builder /app/package.json ./package.json

# Folder upload (di-mount volume di compose)
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3000

# Healthcheck — memastikan app benar-benar melayani, bukan sekedar proses hidup.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
# Jalankan migrasi sebelum start agar schema selalu sinkron.
# Jika ingin mengontrol manual, ganti ke: ["node", "dist/main.js"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
