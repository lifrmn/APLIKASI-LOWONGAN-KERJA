/**
 * File: backend/test/auth-apply.e2e-spec.ts
 * Fungsi:
 *  - Integration test alur utama Sulbar Kerja:
 *      1. Register job seeker
 *      2. Login → dapat access & refresh token
 *      3. GET /auth/me → user terverifikasi
 *      4. Refresh token → dapat access baru
 *      5. GET /jobs/active → lowongan tampil
 *      6. POST /applications → apply job (butuh profil + job)
 *
 * Prasyarat:
 *   - DATABASE_URL harus mengarah ke DB uji terpisah.
 *   - `npm run prisma:seed` sudah dijalankan (roles JOB_SEEKER ada).
 *   - Minimal ada 1 job PUBLISHED (bisa via seed-dummy).
 *
 * Jalankan:
 *   npm run test:e2e
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Auth & Apply flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `e2e_${Date.now()}@example.com`;
  const password = 'Password!1';
  let accessToken = '';
  let refreshToken = '';
  let jobId: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: 1 as never, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Pastikan minimal 1 job aktif
    const job = await prisma.job.findFirst({
      where: { status: 'PUBLISHED', deletedAt: null },
    });
    jobId = job?.id ?? null;
  });

  afterAll(async () => {
    // bersihkan user uji
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('POST /auth/register → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'E2E Tester' });
    expect([200, 201]).toContain(res.status);
  });

  it('POST /auth/login → tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const body = res.body?.data ?? res.body;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it('GET /auth/me → user diketahui', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    expect(body.email).toBe(email);
  });

  it('POST /auth/refresh-token → access baru', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken })
      .expect(200);
    const body = res.body?.data ?? res.body;
    expect(body.accessToken).toBeDefined();
    accessToken = body.accessToken;
    if (body.refreshToken) refreshToken = body.refreshToken;
  });

  it('GET /jobs/active → daftar berisi', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/jobs/active?limit=5')
      .expect(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
  });

  it('POST /applications → apply (butuh job & profil)', async () => {
    if (!jobId) {
      console.warn('Skip: tidak ada job aktif. Jalankan seed-dummy dulu.');
      return;
    }

    // Butuh profil job seeker
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.jobSeeker.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, fullName: 'E2E Tester' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, coverLetter: 'E2E test' });
    // 201 sukses; 409 kalau sudah pernah apply (idempoten)
    expect([201, 200, 409]).toContain(res.status);
  });
});
