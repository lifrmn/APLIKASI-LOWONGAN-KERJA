/**
 * File: backend/prisma/seed-dummy.ts
 * Fungsi:
 *  - Membuat data dummy untuk demo/staging:
 *      * 10 companies (VERIFIED)
 *      * 20 jobs (PUBLISHED, deadline 30 hari)
 *      * 50 job seekers
 *      * ~150 applications acak
 *  - Idempotent per-email (skip bila sudah ada).
 *  - Password semua user dummy: "Password!1"
 *  - Password admin dari seed.ts tidak diubah.
 *
 *  Jalankan (setelah `npm run prisma:seed`):
 *      npx ts-node prisma/seed-dummy.ts
 */

import {
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  Prisma,
  PrismaClient,
  VerificationStatus,
  WorkType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const PASS = 'Password!1';

const FIRST_NAMES = [
  'Budi', 'Siti', 'Ahmad', 'Dewi', 'Muhammad', 'Annisa', 'Fajar', 'Rina',
  'Andi', 'Nurul', 'Rizki', 'Aulia', 'Yusuf', 'Lestari', 'Hendra', 'Fitri',
  'Ilham', 'Sartika', 'Bayu', 'Kartika',
];
const LAST_NAMES = [
  'Santoso', 'Rahmawati', 'Subagyo', 'Lestari', 'Wahyudi', 'Hidayat',
  'Saputra', 'Anggraini', 'Pratama', 'Handayani', 'Setiawan', 'Utami',
];
const COMPANY_TYPES = ['PT', 'CV', 'Yayasan', 'Koperasi'];
const COMPANY_WORDS = [
  'Sulbar', 'Mandiri', 'Sejahtera', 'Global', 'Nusantara', 'Bahari',
  'Cemerlang', 'Digital', 'Karya', 'Bumi', 'Prima', 'Utama',
];
const JOB_TITLES = [
  'Staff Administrasi', 'Frontend Developer', 'Backend Developer',
  'Guru Bahasa Inggris', 'Perawat', 'Kasir Toko', 'Marketing Executive',
  'Content Creator', 'Barista', 'Sopir Operasional', 'Tenaga Kebersihan',
  'Sales Lapangan', 'Teknisi Jaringan', 'Akuntan Junior', 'Desainer Grafis',
  'Customer Service', 'Data Entry', 'Petugas Keamanan', 'Operator Produksi',
  'Chef Restoran',
];

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description: name },
  });
}

async function main() {
  console.log('==> Memastikan roles & kategori/skill tersedia');
  const roleCompany = await ensureRole('COMPANY');
  const roleSeeker = await ensureRole('JOB_SEEKER');

  const categories = await prisma.jobCategory.findMany({ where: { deletedAt: null }, take: 20 });
  const skills = await prisma.skill.findMany({ where: { deletedAt: null }, take: 100 });
  if (skills.length < 3 || categories.length < 1) {
    console.error('Skill/kategori kosong. Jalankan `npm run prisma:seed` terlebih dahulu.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(PASS, 10);

  // -------- COMPANIES --------
  console.log('==> Seeding 10 companies');
  const companies: { id: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const type = rnd(COMPANY_TYPES);
    const w1 = rnd(COMPANY_WORDS);
    const w2 = rnd(COMPANY_WORDS);
    const name = `${type} ${w1} ${w2}`;
    const email = `company${i + 1}@dummy.sulbarkerja.id`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hash,
        fullName: `Owner ${w1}`,
        roleId: roleCompany.id,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    const company = await prisma.company.upsert({
      where: { userId: user.id },
      update: { verificationStatus: VerificationStatus.VERIFIED, verifiedAt: new Date() },
      create: {
        userId: user.id,
        companyName: name,
        businessField: rnd(['Teknologi', 'Perdagangan', 'Jasa', 'Pertanian', 'Konstruksi']),
        description: `${name} adalah perusahaan dummy untuk demo Sulbar Kerja.`,
        email: `hr@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.id`,
        phone: `0812${rndInt(1000, 9999)}${rndInt(1000, 9999)}`,
        address: `Jl. ${w1} No. ${rndInt(1, 200)}, Mamuju`,
        provinceId: '76',
        regencyId: '7604',
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        isActive: true,
      },
    });
    companies.push(company);
  }

  // -------- JOBS --------
  console.log('==> Seeding 20 jobs');
  const jobs: { id: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const company = rnd(companies);
    const title = `${rnd(JOB_TITLES)} #${i + 1}`;
    const deadline = new Date(now.getTime() + rndInt(15, 60) * 86_400_000);
    const salaryMin = rndInt(2, 8) * 500_000;
    const salaryMax = salaryMin + rndInt(1, 4) * 500_000;

    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        title,
        description: `${title} yang bertanggung jawab pada tugas harian di perusahaan.`,
        requirement: 'Minimal SMA/SMK sederajat, jujur, disiplin, mampu bekerja sama.',
        responsibility: 'Menjalankan tugas sesuai SOP dan target harian.',
        jobCategoryId: rnd(categories).id,
        employmentType: rnd([EmploymentType.FULL_TIME, EmploymentType.CONTRACT, EmploymentType.PART_TIME]),
        workType: rnd([WorkType.ONSITE, WorkType.HYBRID, WorkType.REMOTE]),
        minimumEducation: rnd(['SMA', 'SMK', 'D3', 'S1']),
        minimumExperience: rndInt(0, 3),
        salaryMin: new Prisma.Decimal(salaryMin),
        salaryMax: new Prisma.Decimal(salaryMax),
        salaryVisible: Math.random() > 0.3,
        provinceId: '76',
        regencyId: '7604',
        address: `Kantor ${company.id.slice(0, 6)}, Mamuju`,
        deadline,
        quota: rndInt(1, 10),
        status: JobStatus.PUBLISHED,
        publishedAt: now,
      },
    });

    // 2-4 skills per job
    const jobSkills = new Set<string>();
    while (jobSkills.size < rndInt(2, 4)) jobSkills.add(rnd(skills).id);
    for (const skillId of jobSkills) {
      await prisma.jobSkill.create({
        data: { jobId: job.id, skillId, isRequired: Math.random() > 0.5 },
      }).catch(() => {}); // ignore duplicate
    }
    jobs.push(job);
  }

  // -------- JOB SEEKERS --------
  console.log('==> Seeding 50 job seekers');
  const seekers: { id: string }[] = [];
  for (let i = 0; i < 50; i++) {
    const first = rnd(FIRST_NAMES);
    const last = rnd(LAST_NAMES);
    const fullName = `${first} ${last}`;
    const email = `seeker${i + 1}@dummy.sulbarkerja.id`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hash,
        fullName,
        roleId: roleSeeker.id,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    const seeker = await prisma.jobSeeker.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName,
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        birthDate: new Date(1990 + rndInt(0, 15), rndInt(0, 11), rndInt(1, 27)),
        phone: `0813${rndInt(1000, 9999)}${rndInt(1000, 9999)}`,
        address: `Jl. Contoh No. ${rndInt(1, 200)}`,
        provinceId: '76',
        regencyId: rnd(['7601', '7602', '7604', '7605']),
        lastEducation: rnd(['SMA', 'SMK', 'D3', 'S1']),
        major: rnd(['Teknik Informatika', 'Manajemen', 'Akuntansi', 'Bahasa Inggris', 'Pertanian']),
        graduationYear: 2015 + rndInt(0, 10),
        workStatus: rnd(['UNEMPLOYED', 'STUDENT', 'FRESH_GRADUATE', 'EMPLOYED']),
        about: `Saya ${fullName}, siap bekerja keras dan belajar hal baru.`,
      },
    });

    // 3-6 random skills
    const chosen = new Set<string>();
    while (chosen.size < rndInt(3, 6)) chosen.add(rnd(skills).id);
    for (const skillId of chosen) {
      await prisma.jobSeekerSkill.create({
        data: {
          jobSeekerId: seeker.id,
          skillId,
          level: rnd(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
          yearsOfExperience: rndInt(0, 5),
        },
      }).catch(() => {});
    }

    // 1 education
    await prisma.educationHistory.create({
      data: {
        jobSeekerId: seeker.id,
        level: seeker.lastEducation ?? 'S1',
        institution: `Universitas ${rnd(COMPANY_WORDS)}`,
        major: seeker.major,
        startYear: 2015,
        endYear: 2019,
      },
    }).catch(() => {});

    seekers.push(seeker);
  }

  // -------- APPLICATIONS --------
  console.log('==> Seeding ~150 applications');
  const statuses = [
    ApplicationStatus.APPLIED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.REVIEWED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ];
  let created = 0;
  for (const seeker of seekers) {
    const nApp = rndInt(1, 4);
    const jobPool = [...jobs];
    for (let k = 0; k < nApp && jobPool.length; k++) {
      const idx = Math.floor(Math.random() * jobPool.length);
      const [job] = jobPool.splice(idx, 1);
      try {
        await prisma.application.create({
          data: {
            jobId: job.id,
            jobSeekerId: seeker.id,
            status: rnd(statuses),
            coverLetter: 'Saya tertarik dengan lowongan ini dan siap berkontribusi.',
            appliedAt: new Date(now.getTime() - rndInt(0, 20) * 86_400_000),
          },
        });
        created++;
      } catch {
        // unique (jobId, jobSeekerId) collision — abaikan
      }
    }
  }

  console.log(`\nSELESAI. Companies=10, Jobs=20, Seekers=50, Applications=${created}`);
  console.log('Kredensial dummy:');
  console.log('  Company : company1@dummy.sulbarkerja.id .. company10@...  / Password!1');
  console.log('  Seeker  : seeker1@dummy.sulbarkerja.id  .. seeker50@...   / Password!1');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
