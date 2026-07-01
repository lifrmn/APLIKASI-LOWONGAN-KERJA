/**
 * File: backend/prisma/seed.ts
 * Fungsi:
 *  - Idempotent seeder untuk MVP:
 *      * 8 roles (SUPER_ADMIN..LEADER)
 *      * Permission granular per modul + 5 permission SENSITIVE
 *      * Binding role_permissions (SUPER_ADMIN full; role lain terkurasi)
 *      * 1 user SUPER_ADMIN (email/password dari env; hash bcrypt)
 *      * job_categories awal Sulbar
 *      * skills umum
 *      * provinces + regencies Sulbar (kode BPS)
 *      * settings default aplikasi
 *
 *  Jalankan:
 *      cd backend
 *      npx prisma migrate deploy          # pastikan migration jalan
 *      npm run prisma:seed
 *
 *  Env yang dibaca:
 *      SEED_ADMIN_EMAIL     (default: admin@sulbarkerja.id)
 *      SEED_ADMIN_PASSWORD  (default: SulbarKerja!2026 — WAJIB diganti di produksi)
 *      SEED_ADMIN_NAME      (default: Super Admin)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ============================================================
//                            ROLES
// ============================================================
const ROLES: Array<{ name: string; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Akses penuh sistem' },
  { name: 'ADMIN_DINAS', description: 'Admin Disnaker Provinsi Sulbar' },
  { name: 'OPERATOR_KECAMATAN', description: 'Operator tingkat kecamatan' },
  { name: 'OPERATOR_DESA', description: 'Operator tingkat desa/kelurahan' },
  { name: 'LEADER', description: 'Pimpinan / Bupati (read-only dashboard)' },
  { name: 'COMPANY', description: 'Pemilik perusahaan' },
  { name: 'HRD', description: 'HRD perusahaan' },
  { name: 'JOB_SEEKER', description: 'Pencari kerja' },
];

// ============================================================
//                       PERMISSIONS
// ============================================================
// Format: {code}. Code snake.dot (module.action).
const PERMISSIONS: Array<{ code: string; description: string }> = [
  // users
  { code: 'user.read',   description: 'Baca data user' },
  { code: 'user.create', description: 'Buat user baru' },
  { code: 'user.update', description: 'Perbarui data user' },
  { code: 'user.delete', description: 'Hapus (soft) user' },

  // roles/permissions
  { code: 'role.read',        description: 'Baca role' },
  { code: 'role.manage',      description: 'Kelola role (CRUD)' },
  { code: 'permission.read',  description: 'Baca permission' },
  { code: 'permission.manage', description: 'Kelola permission' },

  // job seekers
  { code: 'jobseeker.read',   description: 'Baca profil pencari kerja' },
  { code: 'jobseeker.update', description: 'Perbarui profil pencari kerja' },
  { code: 'jobseeker.delete', description: 'Hapus profil pencari kerja' },

  // companies
  { code: 'company.read',   description: 'Baca perusahaan' },
  { code: 'company.update', description: 'Perbarui perusahaan' },
  { code: 'company.verify', description: 'Verifikasi/tolak perusahaan' },
  { code: 'company.delete', description: 'Hapus perusahaan' },

  // jobs
  { code: 'job.read',    description: 'Baca lowongan' },
  { code: 'job.create',  description: 'Buat lowongan' },
  { code: 'job.update',  description: 'Perbarui lowongan' },
  { code: 'job.publish', description: 'Publish/close lowongan' },
  { code: 'job.delete',  description: 'Hapus lowongan' },

  // applications
  { code: 'application.read',   description: 'Baca lamaran' },
  { code: 'application.apply',  description: 'Melamar pekerjaan' },
  { code: 'application.review', description: 'Review lamaran (HRD)' },

  // files
  { code: 'file.upload', description: 'Upload file' },
  { code: 'file.read',   description: 'Baca file milik sendiri' },
  { code: 'file.manage', description: 'Kelola file (admin)' },

  // dashboard / reports / audit
  { code: 'dashboard.read', description: 'Akses dashboard' },
  { code: 'report.read',    description: 'Akses laporan' },
  { code: 'report.export',  description: 'Ekspor laporan' },
  { code: 'audit.read',     description: 'Baca audit log' },

  // notifications & chat
  { code: 'notification.manage', description: 'Kelola notifikasi (admin/broadcast)' },
  { code: 'chat.read',           description: 'Akses chat' },
  { code: 'chat.send',           description: 'Kirim pesan chat' },

  // AI & OCR
  { code: 'ai.use',        description: 'Menggunakan fitur AI (job matching, CV score)' },
  { code: 'ocr.submit',    description: 'Submit hasil OCR e-KTP' },

  // ========== 5 PERMISSION SENSITIVE ==========
  { code: 'sensitive.identity.read',   description: 'Melihat NIK penuh & data KTP' },
  { code: 'sensitive.identity.verify', description: 'Verifikasi/reject data identitas' },
  { code: 'sensitive.file.read',       description: 'Melihat file milik user lain' },
  { code: 'sensitive.ocr.read',        description: 'Membaca hasil OCR e-KTP milik user lain' },
  { code: 'sensitive.ocr.verify',      description: 'Verifikasi/reject hasil OCR e-KTP' },
];

// ============================================================
//                     ROLE ↔ PERMISSION MAPPING
// ============================================================
// SUPER_ADMIN dapat SEMUA permission (di-handle di runtime).
// Mapping berikut hanya untuk role selain SUPER_ADMIN.
const ROLE_PERMS: Record<string, string[]> = {
  ADMIN_DINAS: [
    'user.read', 'user.create', 'user.update', 'user.delete',
    'role.read', 'permission.read',
    'jobseeker.read', 'jobseeker.update', 'jobseeker.delete',
    'company.read', 'company.update', 'company.verify', 'company.delete',
    'job.read', 'job.publish', 'job.delete',
    'application.read',
    'file.read', 'file.manage',
    'dashboard.read', 'report.read', 'report.export', 'audit.read',
    'notification.manage', 'chat.read',
    // sensitive
    'sensitive.identity.read', 'sensitive.identity.verify',
    'sensitive.file.read', 'sensitive.ocr.read', 'sensitive.ocr.verify',
  ],
  OPERATOR_KECAMATAN: [
    'jobseeker.read', 'company.read', 'job.read', 'application.read',
    'dashboard.read', 'report.read',
  ],
  OPERATOR_DESA: [
    'jobseeker.read', 'company.read', 'job.read',
    'dashboard.read', 'report.read',
  ],
  LEADER: [
    'user.read', 'jobseeker.read', 'company.read', 'job.read',
    'application.read', 'dashboard.read', 'report.read', 'report.export',
  ],
  COMPANY: [
    'company.read', 'company.update',
    'job.read', 'job.create', 'job.update', 'job.publish',
    'application.read', 'application.review',
    'file.upload', 'file.read',
    'dashboard.read', 'chat.read', 'chat.send',
  ],
  HRD: [
    'company.read',
    'job.read',
    'application.read', 'application.review',
    'file.upload', 'file.read',
    'dashboard.read', 'chat.read', 'chat.send',
  ],
  JOB_SEEKER: [
    'jobseeker.read', 'jobseeker.update',
    'job.read',
    'application.apply', 'application.read',
    'file.upload', 'file.read',
    'dashboard.read', 'chat.read', 'chat.send',
    'ai.use', 'ocr.submit',
  ],
};

// ============================================================
//                       JOB CATEGORIES
// ============================================================
const JOB_CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: 'Teknologi Informasi', slug: 'teknologi-informasi' },
  { name: 'Administrasi & Perkantoran', slug: 'administrasi' },
  { name: 'Pendidikan', slug: 'pendidikan' },
  { name: 'Kesehatan', slug: 'kesehatan' },
  { name: 'Konstruksi & Sipil', slug: 'konstruksi' },
  { name: 'Perhotelan & Pariwisata', slug: 'perhotelan' },
  { name: 'Pemerintahan', slug: 'pemerintahan' },
  { name: 'Pertanian & Perikanan', slug: 'pertanian' },
  { name: 'Perbankan & Keuangan', slug: 'keuangan' },
  { name: 'Manufaktur', slug: 'manufaktur' },
  { name: 'Transportasi & Logistik', slug: 'logistik' },
  { name: 'Penjualan & Pemasaran', slug: 'sales-marketing' },
  { name: 'Desain & Kreatif', slug: 'desain-kreatif' },
];

// ============================================================
//                            SKILLS
// ============================================================
const SKILLS: Array<{ name: string; category: string }> = [
  // Soft skills
  { name: 'Komunikasi',    category: 'Soft Skill' },
  { name: 'Kerja Tim',     category: 'Soft Skill' },
  { name: 'Kepemimpinan',  category: 'Soft Skill' },
  { name: 'Manajemen Waktu', category: 'Soft Skill' },
  { name: 'Problem Solving', category: 'Soft Skill' },

  // Perkantoran
  { name: 'Microsoft Word',   category: 'Perkantoran' },
  { name: 'Microsoft Excel',  category: 'Perkantoran' },
  { name: 'Microsoft PowerPoint', category: 'Perkantoran' },
  { name: 'Google Workspace', category: 'Perkantoran' },
  { name: 'Administrasi Umum', category: 'Perkantoran' },

  // IT
  { name: 'HTML',        category: 'IT' },
  { name: 'CSS',         category: 'IT' },
  { name: 'JavaScript',  category: 'IT' },
  { name: 'TypeScript',  category: 'IT' },
  { name: 'PHP',         category: 'IT' },
  { name: 'Python',      category: 'IT' },
  { name: 'Java',        category: 'IT' },
  { name: 'Kotlin',      category: 'IT' },
  { name: 'Flutter',     category: 'IT' },
  { name: 'React',       category: 'IT' },
  { name: 'Node.js',     category: 'IT' },
  { name: 'NestJS',      category: 'IT' },
  { name: 'PostgreSQL',  category: 'IT' },
  { name: 'MySQL',       category: 'IT' },
  { name: 'Git',         category: 'IT' },
  { name: 'Docker',      category: 'IT' },

  // Design
  { name: 'Figma',       category: 'Desain' },
  { name: 'Adobe Photoshop', category: 'Desain' },
  { name: 'Adobe Illustrator', category: 'Desain' },
  { name: 'CorelDRAW',   category: 'Desain' },

  // Bahasa
  { name: 'Bahasa Indonesia', category: 'Bahasa' },
  { name: 'Bahasa Inggris',   category: 'Bahasa' },
  { name: 'Bahasa Arab',      category: 'Bahasa' },

  // Layanan
  { name: 'Customer Service', category: 'Layanan' },
  { name: 'Sales',            category: 'Layanan' },
  { name: 'Marketing',        category: 'Layanan' },
  { name: 'Kasir',            category: 'Layanan' },
];

// ============================================================
//                         WILAYAH
// ============================================================
// Kode BPS Sulawesi Barat = 76. Data 6 kabupaten resmi.
// Data kecamatan/desa akan di-load terpisah dari CSV di iterasi berikutnya.
const PROVINCES = [
  { id: '76', name: 'Sulawesi Barat' },
];

const REGENCIES = [
  { id: '7601', provinceId: '76', name: 'Majene' },
  { id: '7602', provinceId: '76', name: 'Polewali Mandar' },
  { id: '7603', provinceId: '76', name: 'Mamasa' },
  { id: '7604', provinceId: '76', name: 'Mamuju' },
  { id: '7605', provinceId: '76', name: 'Pasangkayu' },
  { id: '7606', provinceId: '76', name: 'Mamuju Tengah' },
];

// ============================================================
//                          SETTINGS
// ============================================================
const SETTINGS: Array<{ key: string; value: Prisma.InputJsonValue; description: string }> = [
  { key: 'app.name',        value: 'Sulbar Kerja', description: 'Nama aplikasi' },
  { key: 'app.tagline',     value: 'Bursa Kerja Digital Provinsi Sulawesi Barat', description: 'Tagline' },
  { key: 'app.maintenance', value: false as unknown as Prisma.InputJsonValue, description: 'Mode maintenance' },
  {
    key: 'ai.matching.weights',
    value: { skill: 60, education: 20, location: 10, experience: 10 } as unknown as Prisma.InputJsonValue,
    description: 'Bobot job matching rule-based (persen)',
  },
  {
    key: 'ocr.confidence.threshold',
    value: 0.75 as unknown as Prisma.InputJsonValue,
    description: 'Ambang confidence OCR untuk auto-approve (masih dilarang di MVP, wajib manual)',
  },
];

// ============================================================
//                             MAIN
// ============================================================
async function main() {
  console.log('==> Seeding roles');
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, deletedAt: null },
      create: r,
    });
  }

  console.log('==> Seeding permissions');
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, deletedAt: null },
      create: p,
    });
  }

  console.log('==> Binding role_permissions');
  const allPerms = await prisma.permission.findMany({ where: { deletedAt: null } });
  const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  // SUPER_ADMIN: semua permission
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: p.id },
    });
  }
  // role lain terkurasi
  for (const [roleName, codes] of Object.entries(ROLE_PERMS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const code of codes) {
      const pid = permByCode.get(code);
      if (!pid) {
        console.warn(`  ! Permission '${code}' untuk role ${roleName} tidak ditemukan, dilewati.`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: pid } },
        update: {},
        create: { roleId: role.id, permissionId: pid },
      });
    }
  }

  console.log('==> Seeding SUPER_ADMIN user');
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@sulbarkerja.id';
  const adminPass  = process.env.SEED_ADMIN_PASSWORD ?? 'SulbarKerja!2026';
  const adminName  = process.env.SEED_ADMIN_NAME ?? 'Super Admin';
  const hash = await bcrypt.hash(adminPass, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { roleId: superAdmin.id, fullName: adminName, status: 'ACTIVE' },
    create: {
      email: adminEmail,
      password: hash,
      fullName: adminName,
      roleId: superAdmin.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`   admin  : ${adminEmail}`);
  console.log(`   password: ${adminPass}   (GANTI SEGERA setelah login pertama)`);

  console.log('==> Seeding job categories');
  for (const c of JOB_CATEGORIES) {
    await prisma.jobCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, deletedAt: null },
      create: c,
    });
  }

  console.log('==> Seeding skills');
  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { name: s.name },
      update: { category: s.category, deletedAt: null },
      create: s,
    });
  }

  console.log('==> Seeding wilayah (Provinsi + Kabupaten Sulbar)');
  for (const p of PROVINCES) {
    await prisma.province.upsert({ where: { id: p.id }, update: { name: p.name }, create: p });
  }
  for (const r of REGENCIES) {
    await prisma.regency.upsert({
      where: { id: r.id },
      update: { name: r.name, provinceId: r.provinceId },
      create: r,
    });
  }

  console.log('==> Seeding settings');
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }

  console.log('\nSEED SELESAI.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
