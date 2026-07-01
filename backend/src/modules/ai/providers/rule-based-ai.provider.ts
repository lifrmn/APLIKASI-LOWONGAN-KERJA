/**
 * File: backend/src/modules/ai/providers/rule-based-ai.provider.ts
 * Fungsi:
 *  - Implementasi AI provider berbasis aturan (rule-based) untuk MVP.
 *  - Tidak memanggil API eksternal. Semua hitungan dilakukan dari
 *    data yang sudah ada di database (JobSeeker, Job, Skill, dll).
 *  - Bobot scoring:
 *      * Job Matching : skill 60% · pendidikan 20% · lokasi 10% · pengalaman 10%
 *      * CV Scoring   : biodata 20 · pendidikan 15 · pengalaman 15 · skill 20
 *                       · CV file 15 · sertifikat/portofolio 10 · about 5
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { CvScoreCategory, JobStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import {
  AiProvider,
  CvScoreResult,
  JobMatchResult,
  ResumeParseResult,
  SkillRecommendationItem,
} from './ai-provider.interface';

// ------- konstanta tingkatan pendidikan (urut naik) -------
const EDU_RANK: Record<string, number> = {
  SD: 1,
  SMP: 2,
  SMA: 3,
  SMK: 3,
  D1: 4,
  D2: 4,
  D3: 5,
  D4: 6,
  S1: 6,
  S2: 7,
  S3: 8,
};

// ------- pemetaan ranking skill level -------
const SKILL_LEVEL_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

// ------- include detail JobSeeker untuk perhitungan AI -------
const jobSeekerInclude = {
  skills: { include: { skill: true } },
  educations: true,
  experiences: true,
  certificates: { where: { deletedAt: null } },
  portfolios: { where: { deletedAt: null } },
  cvFile: true,
} satisfies Prisma.JobSeekerInclude;

type JobSeekerFull = Prisma.JobSeekerGetPayload<{ include: typeof jobSeekerInclude }>;

const jobInclude = {
  skills: { include: { skill: true } },
} satisfies Prisma.JobInclude;

type JobFull = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

@Injectable()
export class RuleBasedAiProvider implements AiProvider {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  //                          CV SCORING
  // ============================================================
  async scoreCv(jobSeekerId: string): Promise<CvScoreResult> {
    const seeker = await this.prisma.jobSeeker.findFirst({
      where: { id: jobSeekerId, deletedAt: null },
      include: jobSeekerInclude,
    });
    if (!seeker) throw new NotFoundException('Pencari kerja tidak ditemukan');

    const breakdown: Array<{ key: string; score: number; max: number }> = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // 1. Biodata (max 20) — fullName, phone, birthDate, gender, address
    const bioFields = [seeker.fullName, seeker.phone, seeker.birthDate, seeker.gender, seeker.address];
    const bioFilled = bioFields.filter(Boolean).length;
    const bioScore = Math.round((bioFilled / bioFields.length) * 20);
    breakdown.push({ key: 'biodata', score: bioScore, max: 20 });
    if (bioScore >= 16) strengths.push('Biodata lengkap');
    else {
      weaknesses.push('Biodata belum lengkap');
      recommendations.push('Lengkapi nama, nomor HP, tanggal lahir, jenis kelamin, dan alamat');
    }

    // 2. Pendidikan (max 15)
    const eduCount = seeker.educations.length;
    const lastEduFilled = !!seeker.lastEducation;
    let eduScore = 0;
    if (eduCount > 0) eduScore += 10;
    if (lastEduFilled) eduScore += 5;
    eduScore = Math.min(15, eduScore);
    breakdown.push({ key: 'pendidikan', score: eduScore, max: 15 });
    if (eduScore >= 12) strengths.push('Riwayat pendidikan terisi');
    else recommendations.push('Tambahkan minimal 1 riwayat pendidikan dan tingkat pendidikan terakhir');

    // 3. Pengalaman (max 15)
    const expCount = seeker.experiences.length;
    let expScore = 0;
    if (expCount >= 1) expScore = 8;
    if (expCount >= 2) expScore = 12;
    if (expCount >= 3) expScore = 15;
    breakdown.push({ key: 'pengalaman', score: expScore, max: 15 });
    if (expCount === 0) recommendations.push('Tambahkan pengalaman kerja walau magang atau freelance');
    else strengths.push(`Memiliki ${expCount} pengalaman kerja`);

    // 4. Skill (max 20)
    const skillCount = seeker.skills.length;
    let skillScore = 0;
    if (skillCount >= 1) skillScore = 8;
    if (skillCount >= 3) skillScore = 14;
    if (skillCount >= 5) skillScore = 18;
    if (skillCount >= 8) skillScore = 20;
    breakdown.push({ key: 'skill', score: skillScore, max: 20 });
    if (skillCount === 0) recommendations.push('Tambahkan minimal 3 skill relevan');
    else if (skillCount < 5) recommendations.push('Tambahkan lagi skill agar lebih kompetitif');
    else strengths.push(`Memiliki ${skillCount} skill terdaftar`);

    // 5. CV file (max 15)
    const cvScore = seeker.cvFileId ? 15 : 0;
    breakdown.push({ key: 'cv_file', score: cvScore, max: 15 });
    if (!cvScore) {
      weaknesses.push('Belum mengunggah CV');
      recommendations.push('Unggah CV PDF terbaru di profil Anda');
    } else strengths.push('CV sudah terunggah');

    // 6. Sertifikat / Portofolio (max 10)
    const certCount = seeker.certificates.length;
    const portCount = seeker.portfolios.length;
    let extraScore = 0;
    if (certCount > 0) extraScore += 5;
    if (portCount > 0) extraScore += 5;
    extraScore = Math.min(10, extraScore);
    breakdown.push({ key: 'sertifikat_portofolio', score: extraScore, max: 10 });
    if (extraScore === 0) recommendations.push('Unggah sertifikat dan/atau portofolio');

    // 7. About (max 5)
    const aboutScore = seeker.about && seeker.about.trim().length >= 30 ? 5 : 0;
    breakdown.push({ key: 'about', score: aboutScore, max: 5 });
    if (!aboutScore) recommendations.push('Tulis ringkasan diri minimal 30 karakter');

    const total = breakdown.reduce((acc, b) => acc + b.score, 0);
    const category = categorize(total);

    // simpan history
    await this.prisma.aiCvScore.create({
      data: {
        jobSeekerId: seeker.id,
        score: total,
        category,
        strengths: strengths as unknown as Prisma.InputJsonValue,
        weaknesses: weaknesses as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      jobSeekerId: seeker.id,
      score: total,
      category,
      breakdown,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  // ============================================================
  //                         JOB MATCHING
  // ============================================================
  async matchJobs(jobSeekerId: string, limit = 20): Promise<JobMatchResult[]> {
    const seeker = await this.prisma.jobSeeker.findFirst({
      where: { id: jobSeekerId, deletedAt: null },
      include: jobSeekerInclude,
    });
    if (!seeker) throw new NotFoundException('Pencari kerja tidak ditemukan');

    const jobs = await this.prisma.job.findMany({
      where: {
        deletedAt: null,
        status: JobStatus.PUBLISHED,
        OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
      },
      include: jobInclude,
      take: 500, // hard cap supaya tidak membaca seluruh tabel
      orderBy: { publishedAt: 'desc' },
    });

    const results: JobMatchResult[] = jobs.map((job) => this.computeMatch(seeker, job));
    results.sort((a, b) => b.matchScore - a.matchScore);
    const top = results.slice(0, Math.max(1, Math.min(100, limit)));

    // cache hasil top ke tabel ai_job_recommendations (upsert)
    await this.prisma.$transaction(
      top.map((r) =>
        this.prisma.aiJobRecommendation.upsert({
          where: {
            jobSeekerId_jobId: { jobSeekerId: seeker.id, jobId: r.jobId },
          },
          create: {
            jobSeekerId: seeker.id,
            jobId: r.jobId,
            matchScore: r.matchScore,
            reasons: r.reasons as unknown as Prisma.InputJsonValue,
          },
          update: {
            matchScore: r.matchScore,
            reasons: r.reasons as unknown as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    return top;
  }

  private computeMatch(seeker: JobSeekerFull, job: JobFull): JobMatchResult {
    // ---- 1. Skill (60) ----
    const seekerSkills = new Map<string, number>(
      seeker.skills.map((s) => [s.skillId, SKILL_LEVEL_RANK[s.level ?? ''] ?? 1]),
    );
    const requiredSkills = job.skills.filter((s) => s.isRequired);
    const totalSkillsCount = job.skills.length || 1;
    let matched = 0;
    const matchedSkillNames: string[] = [];
    for (const js of job.skills) {
      if (seekerSkills.has(js.skillId)) {
        matched += 1;
        matchedSkillNames.push(js.skill.name);
      }
    }
    const skillRatio = matched / totalSkillsCount;
    const skillScore = Math.round(skillRatio * 60);

    // required wajib semua untuk top score
    const requiredMatched = requiredSkills.filter((s) => seekerSkills.has(s.skillId)).length;
    const requiredOk = requiredSkills.length === 0 || requiredMatched === requiredSkills.length;

    // ---- 2. Pendidikan (20) ----
    const seekerEduRank = EDU_RANK[(seeker.lastEducation ?? '').toUpperCase()] ?? 0;
    const minEduRank = EDU_RANK[(job.minimumEducation ?? '').toUpperCase()] ?? 0;
    let eduScore = 0;
    if (!job.minimumEducation) eduScore = 14; // tidak ada syarat → kasih sebagian
    else if (seekerEduRank >= minEduRank && seekerEduRank > 0) eduScore = 20;
    else if (seekerEduRank > 0) eduScore = 8;

    // ---- 3. Lokasi (10) ----
    let locScore = 0;
    const matches = (a?: string | null, b?: string | null) => !!a && !!b && a === b;
    if (matches(seeker.villageId, job.villageId)) locScore = 10;
    else if (matches(seeker.districtId, job.districtId)) locScore = 8;
    else if (matches(seeker.regencyId, job.regencyId)) locScore = 6;
    else if (matches(seeker.provinceId, job.provinceId)) locScore = 4;
    else if (!job.provinceId && !job.regencyId && !job.districtId) locScore = 5; // remote/tidak spesifik

    // ---- 4. Pengalaman (10) ----
    const seekerYears = estimateYearsOfExperience(seeker.experiences);
    const minYears = job.minimumExperience ?? 0;
    let expScore = 0;
    if (minYears <= 0) expScore = 8;
    else if (seekerYears >= minYears) expScore = 10;
    else if (seekerYears >= minYears - 1) expScore = 6;
    else if (seekerYears > 0) expScore = 3;

    let total = skillScore + eduScore + locScore + expScore;
    if (!requiredOk) total = Math.round(total * 0.7); // penalty bila skill wajib tidak terpenuhi
    total = Math.max(0, Math.min(100, total));

    const reasons: string[] = [];
    if (matchedSkillNames.length)
      reasons.push(`Skill cocok: ${matchedSkillNames.slice(0, 5).join(', ')}`);
    if (!requiredOk) reasons.push('Beberapa skill wajib belum dimiliki');
    if (eduScore >= 14) reasons.push('Pendidikan sesuai dengan persyaratan');
    if (locScore >= 6) reasons.push('Lokasi berada dalam wilayah yang relevan');
    if (expScore >= 8) reasons.push('Pengalaman memenuhi syarat');

    return {
      jobId: job.id,
      matchScore: total,
      reasons,
      components: { skill: skillScore, education: eduScore, location: locScore, experience: expScore },
    };
  }

  // ============================================================
  //                       RESUME PARSER
  // ============================================================
  async parseResume(text: string): Promise<ResumeParseResult> {
    const cleaned = (text ?? '').replace(/\r/g, '').slice(0, 200_000); // cap 200KB

    const emails = unique(cleaned.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []);
    const phoneMatches = cleaned.match(/(?:\+62|62|0)8\d{7,12}/g) ?? [];
    const phones = unique(phoneMatches.map((p) => p.replace(/[^0-9+]/g, '')));

    const eduKeywords = unique(
      (cleaned.match(/\b(SD|SMP|SMA|SMK|D1|D2|D3|D4|S1|S2|S3|Sarjana|Diploma|Magister|Doktor)\b/gi) ?? [])
        .map((k) => k.toUpperCase()),
    );

    // skill detection — match against master skills (case-insensitive whole word)
    const skills = await this.prisma.skill.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    const lower = cleaned.toLowerCase();
    const detectedSkills = unique(
      skills
        .filter((s) => {
          const n = s.name.toLowerCase();
          // word boundary aman untuk multi-kata juga
          const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(n)}([^a-z0-9]|$)`, 'i');
          return re.test(lower);
        })
        .map((s) => s.name),
    );

    // experience years — cari pola "X tahun" atau "X years"
    const yearMatches = cleaned.match(/(\d{1,2})\s*(?:tahun|years?)/gi) ?? [];
    let experienceYears: number | null = null;
    if (yearMatches.length) {
      const nums = yearMatches
        .map((m) => parseInt(m, 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 50);
      if (nums.length) experienceYears = Math.max(...nums);
    }

    return {
      emails,
      phones,
      skills: detectedSkills,
      educationKeywords: eduKeywords,
      experienceYears,
      rawTextLength: cleaned.length,
    };
  }

  // ============================================================
  //                     SKILL RECOMMENDATION
  // ============================================================
  async recommendSkills(jobSeekerId: string, limit = 10): Promise<SkillRecommendationItem[]> {
    const seeker = await this.prisma.jobSeeker.findFirst({
      where: { id: jobSeekerId, deletedAt: null },
      include: { skills: true },
    });
    if (!seeker) throw new NotFoundException('Pencari kerja tidak ditemukan');

    const owned = new Set(seeker.skills.map((s) => s.skillId));

    // hitung frekuensi skill dari lowongan AKTIF
    const grouped = await this.prisma.jobSkill.groupBy({
      by: ['skillId'],
      where: {
        job: {
          deletedAt: null,
          status: JobStatus.PUBLISHED,
          OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
        },
      },
      _count: { skillId: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: Math.max(limit * 3, 30),
    });

    const candidateIds = grouped.map((g) => g.skillId).filter((id) => !owned.has(id));
    if (!candidateIds.length) return [];

    const skills = await this.prisma.skill.findMany({
      where: { id: { in: candidateIds }, deletedAt: null },
      select: { id: true, name: true, category: true },
    });
    const skillMap = new Map(skills.map((s) => [s.id, s]));
    const freqMap = new Map(grouped.map((g) => [g.skillId, g._count.skillId]));

    return candidateIds
      .map((id) => {
        const meta = skillMap.get(id);
        if (!meta) return null;
        return {
          skillId: meta.id,
          name: meta.name,
          category: meta.category,
          frequency: freqMap.get(id) ?? 0,
        };
      })
      .filter((x): x is SkillRecommendationItem => x !== null)
      .slice(0, limit);
  }
}

// ===================== helpers =====================
function categorize(score: number): CvScoreCategory {
  if (score >= 90) return 'SANGAT_BAIK';
  if (score >= 75) return 'BAIK';
  if (score >= 50) return 'CUKUP';
  return 'PERLU_DILENGKAPI';
}

function estimateYearsOfExperience(experiences: { startDate: Date; endDate: Date | null; isCurrent: boolean }[]): number {
  if (!experiences.length) return 0;
  const now = new Date();
  let totalMonths = 0;
  for (const e of experiences) {
    const start = e.startDate;
    const end = e.isCurrent || !e.endDate ? now : e.endDate;
    const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
    totalMonths += months;
  }
  return Math.floor(totalMonths / 12);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
