/**
 * File: backend/src/modules/dashboard/dashboard.service.ts
 * Fungsi:
 *  - Logika agregat statistik aplikasi.
 *  - Setiap metode menerima `DashboardFilterDto` dan menerapkan
 *    filter rentang tanggal pada kolom yang relevan (createdAt /
 *    appliedAt) tanpa mengubah jumlah index DB.
 *  - Untuk grouping per bulan, dipakai `$queryRaw` PostgreSQL
 *    (`date_trunc('month', ...)`) agar efisien.
 *  - Tidak ada mutasi data — module ini read-only.
 */

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  Company,
  JobStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

interface DateRange {
  start?: Date;
  end?: Date;
}

interface MonthlyBucket {
  month: string; // ISO date awal bulan
  count: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  //                            SUMMARY
  // ============================================================

  /**
   * summary()
   * Ringkasan utama untuk admin / leader / dashboard generic.
   */
  async summary(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);
    const applied = this.dateFilter('appliedAt', range);

    const [
      totalUsers,
      totalJobSeekers,
      totalCompanies,
      totalJobs,
      totalActiveJobs,
      totalApplications,
      totalAccepted,
      totalRejected,
      totalInterviews,
      verifiedCompanies,
      unverifiedCompanies,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, ...created } }),
      this.prisma.jobSeeker.count({ where: { deletedAt: null, ...created } }),
      this.prisma.company.count({ where: { deletedAt: null, ...created } }),
      this.prisma.job.count({ where: { deletedAt: null, ...created } }),
      this.prisma.job.count({
        where: {
          deletedAt: null,
          status: JobStatus.PUBLISHED,
          OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
          ...created,
        },
      }),
      this.prisma.application.count({ where: { deletedAt: null, ...applied } }),
      this.prisma.application.count({
        where: { deletedAt: null, status: ApplicationStatus.ACCEPTED, ...applied },
      }),
      this.prisma.application.count({
        where: { deletedAt: null, status: ApplicationStatus.REJECTED, ...applied },
      }),
      this.prisma.interview.count({
        where: range.start || range.end ? this.dateFilter('createdAt', range) : {},
      }),
      this.prisma.company.count({
        where: { deletedAt: null, verificationStatus: VerificationStatus.VERIFIED, ...created },
      }),
      this.prisma.company.count({
        where: {
          deletedAt: null,
          verificationStatus: { not: VerificationStatus.VERIFIED },
          ...created,
        },
      }),
    ]);

    return {
      totalUsers,
      totalJobSeekers,
      totalCompanies,
      totalJobs,
      totalActiveJobs,
      totalApplications,
      totalAccepted,
      totalRejected,
      totalInterviews,
      verifiedCompanies,
      unverifiedCompanies,
    };
  }

  // ============================================================
  //                            ADMIN
  // ============================================================

  /**
   * adminDashboard()
   * Statistik lengkap untuk admin: summary + breakdown.
   */
  async adminDashboard(filter: DashboardFilterDto) {
    const [
      summary,
      usersByRole,
      jobSeekersByEducation,
      companiesByVerification,
      jobsByCategory,
      jobsByStatus,
      applicationsByStatus,
      topJobSeekerSkills,
      topJobSkills,
      monthlyJobs,
      monthlyApplications,
    ] = await Promise.all([
      this.summary(filter),
      this.usersByRole(filter),
      this.jobSeekersByEducation(filter),
      this.companiesByVerification(filter),
      this.jobsByCategory(filter),
      this.jobsByStatus(filter),
      this.applicationsByStatus(filter),
      this.topJobSeekerSkills(10),
      this.topJobSkills(10),
      this.monthlyJobs(filter),
      this.monthlyApplications(filter),
    ]);

    return {
      summary,
      usersByRole,
      jobSeekersByEducation,
      companiesByVerification,
      jobsByCategory,
      jobsByStatus,
      applicationsByStatus,
      topJobSeekerSkills,
      topJobSkills,
      monthlyJobs,
      monthlyApplications,
    };
  }

  // ============================================================
  //                            COMPANY
  // ============================================================

  /**
   * companyDashboard()
   * Statistik untuk akun perusahaan / HRD: hanya data perusahaannya.
   */
  async companyDashboard(actor: AuthUser, filter: DashboardFilterDto) {
    const company = await this.resolveActorCompany(actor);
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);
    const applied = this.dateFilter('appliedAt', range);

    const [
      totalJobs,
      activeJobs,
      draftJobs,
      closedJobs,
      totalApplications,
      applicationsByStatus,
      monthlyApplications,
    ] = await Promise.all([
      this.prisma.job.count({ where: { companyId: company.id, deletedAt: null, ...created } }),
      this.prisma.job.count({
        where: {
          companyId: company.id,
          deletedAt: null,
          status: JobStatus.PUBLISHED,
          OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
          ...created,
        },
      }),
      this.prisma.job.count({
        where: { companyId: company.id, deletedAt: null, status: JobStatus.DRAFT, ...created },
      }),
      this.prisma.job.count({
        where: { companyId: company.id, deletedAt: null, status: JobStatus.CLOSED, ...created },
      }),
      this.prisma.application.count({
        where: { deletedAt: null, job: { companyId: company.id }, ...applied },
      }),
      this.applicationsByStatus(filter, { companyId: company.id }),
      this.monthlyApplications(filter, { companyId: company.id }),
    ]);

    return {
      company: { id: company.id, companyName: company.companyName },
      totalJobs,
      activeJobs,
      draftJobs,
      closedJobs,
      totalApplications,
      applicationsByStatus,
      monthlyApplications,
    };
  }

  // ============================================================
  //                           JOB SEEKER
  // ============================================================

  /**
   * jobSeekerDashboard()
   * Statistik untuk pencari kerja login.
   */
  async jobSeekerDashboard(actor: AuthUser, filter: DashboardFilterDto) {
    if (actor.role !== 'JOB_SEEKER') {
      throw new ForbiddenException('Endpoint ini hanya untuk JOB_SEEKER');
    }
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja belum dibuat');

    const range = this.parseRange(filter);
    const applied = this.dateFilter('appliedAt', range);

    const [
      totalApplications,
      applicationsByStatus,
      interviewsCount,
      activeInterviews,
    ] = await Promise.all([
      this.prisma.application.count({
        where: { jobSeekerId: profile.id, deletedAt: null, ...applied },
      }),
      this.applicationsByStatus(filter, { jobSeekerId: profile.id }),
      this.prisma.interview.count({
        where: { application: { jobSeekerId: profile.id } },
      }),
      this.prisma.interview.count({
        where: {
          application: { jobSeekerId: profile.id },
          status: 'SCHEDULED',
          scheduledAt: { gte: new Date() },
        },
      }),
    ]);

    return {
      profile,
      totalApplications,
      applicationsByStatus,
      interviewsCount,
      upcomingInterviews: activeInterviews,
    };
  }

  // ============================================================
  //                            LEADER
  // ============================================================

  /**
   * leaderDashboard()
   * Untuk pimpinan/Bupati: summary + statistik regional + skill.
   */
  async leaderDashboard(filter: DashboardFilterDto) {
    const [
      summary,
      jobSeekersByDistrict,
      jobSeekersByVillage,
      companiesByDistrict,
      jobsByCategory,
      topJobSeekerSkills,
      monthlyJobs,
      monthlyApplications,
    ] = await Promise.all([
      this.summary(filter),
      this.regionStats('jobSeekersByDistrict'),
      this.regionStats('jobSeekersByVillage'),
      this.regionStats('companiesByDistrict'),
      this.jobsByCategory(filter),
      this.topJobSeekerSkills(10),
      this.monthlyJobs(filter),
      this.monthlyApplications(filter),
    ]);

    return {
      summary,
      jobSeekersByDistrict,
      jobSeekersByVillage,
      companiesByDistrict,
      jobsByCategory,
      topJobSeekerSkills,
      monthlyJobs,
      monthlyApplications,
    };
  }

  // ============================================================
  //                       BREAKDOWN ENDPOINTS
  // ============================================================

  /**
   * usersByRole()
   * Hitung user per role.
   */
  async usersByRole(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);

    const grouped = await this.prisma.user.groupBy({
      by: ['roleId'],
      where: { deletedAt: null, ...created },
      _count: { _all: true },
    });

    if (grouped.length === 0) return [];

    const roles = await this.prisma.role.findMany({
      where: { id: { in: grouped.map((g) => g.roleId) } },
      select: { id: true, name: true },
    });
    const map = new Map(roles.map((r) => [r.id, r.name]));

    return grouped
      .map((g) => ({ role: map.get(g.roleId) ?? 'UNKNOWN', total: g._count._all }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * jobSeekersByEducation()
   */
  async jobSeekersByEducation(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);

    const grouped = await this.prisma.jobSeeker.groupBy({
      by: ['lastEducation'],
      where: { deletedAt: null, ...created },
      _count: { _all: true },
    });

    return grouped
      .map((g) => ({ lastEducation: g.lastEducation ?? 'UNKNOWN', total: g._count._all }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * companiesByVerification()
   */
  async companiesByVerification(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);

    const grouped = await this.prisma.company.groupBy({
      by: ['verificationStatus'],
      where: { deletedAt: null, ...created },
      _count: { _all: true },
    });

    return grouped.map((g) => ({ status: g.verificationStatus, total: g._count._all }));
  }

  /**
   * jobsByCategory()
   */
  async jobsByCategory(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);

    const grouped = await this.prisma.job.groupBy({
      by: ['jobCategoryId'],
      where: { deletedAt: null, ...created },
      _count: { _all: true },
    });

    const categoryIds = grouped.map((g) => g.jobCategoryId).filter((id): id is string => !!id);
    const categories = categoryIds.length
      ? await this.prisma.jobCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const map = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        categoryId: g.jobCategoryId,
        category: g.jobCategoryId ? map.get(g.jobCategoryId) ?? 'UNKNOWN' : 'UNCATEGORIZED',
        total: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * jobsByStatus()
   */
  async jobsByStatus(filter: DashboardFilterDto) {
    const range = this.parseRange(filter);
    const created = this.dateFilter('createdAt', range);

    const grouped = await this.prisma.job.groupBy({
      by: ['status'],
      where: { deletedAt: null, ...created },
      _count: { _all: true },
    });

    return grouped.map((g) => ({ status: g.status, total: g._count._all }));
  }

  /**
   * applicationsByStatus()
   * Bisa difilter per company atau per jobSeeker.
   */
  async applicationsByStatus(
    filter: DashboardFilterDto,
    scope: { companyId?: string; jobSeekerId?: string } = {},
  ) {
    const range = this.parseRange(filter);
    const applied = this.dateFilter('appliedAt', range);

    const where: Prisma.ApplicationWhereInput = {
      deletedAt: null,
      ...applied,
      ...(scope.companyId && { job: { companyId: scope.companyId } }),
      ...(scope.jobSeekerId && { jobSeekerId: scope.jobSeekerId }),
    };

    const grouped = await this.prisma.application.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    return grouped.map((g) => ({ status: g.status, total: g._count._all }));
  }

  /**
   * interviewsByStatus()
   */
  async interviewsByStatus() {
    const grouped = await this.prisma.interview.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, total: g._count._all }));
  }

  /**
   * topJobSeekerSkills()
   * Skill paling banyak dimiliki pencari kerja.
   */
  async topJobSeekerSkills(limit = 10) {
    const grouped = await this.prisma.jobSeekerSkill.groupBy({
      by: ['skillId'],
      _count: { _all: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const skills = await this.prisma.skill.findMany({
      where: { id: { in: grouped.map((g) => g.skillId) } },
      select: { id: true, name: true },
    });
    const map = new Map(skills.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      skillId: g.skillId,
      skill: map.get(g.skillId) ?? 'UNKNOWN',
      total: g._count._all,
    }));
  }

  /**
   * topJobSkills()
   * Skill paling banyak dibutuhkan lowongan.
   */
  async topJobSkills(limit = 10) {
    const grouped = await this.prisma.jobSkill.groupBy({
      by: ['skillId'],
      _count: { _all: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const skills = await this.prisma.skill.findMany({
      where: { id: { in: grouped.map((g) => g.skillId) } },
      select: { id: true, name: true },
    });
    const map = new Map(skills.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      skillId: g.skillId,
      skill: map.get(g.skillId) ?? 'UNKNOWN',
      total: g._count._all,
    }));
  }

  /**
   * skillsStats()
   * Gabungan topJobSeekerSkills + topJobSkills (untuk endpoint /skills).
   */
  async skillsStats(limit = 10) {
    const [jobSeekers, jobs] = await Promise.all([
      this.topJobSeekerSkills(limit),
      this.topJobSkills(limit),
    ]);
    return { topJobSeekerSkills: jobSeekers, topJobSkills: jobs };
  }

  /**
   * regionsStats()
   * Gabungan breakdown JS by district, JS by village, Companies by district.
   */
  async regionsStats() {
    const [
      jobSeekersByDistrict,
      jobSeekersByVillage,
      companiesByDistrict,
      companiesByVillage,
    ] = await Promise.all([
      this.regionStats('jobSeekersByDistrict'),
      this.regionStats('jobSeekersByVillage'),
      this.regionStats('companiesByDistrict'),
      this.regionStats('companiesByVillage'),
    ]);

    return {
      jobSeekersByDistrict,
      jobSeekersByVillage,
      companiesByDistrict,
      companiesByVillage,
    };
  }

  // ============================================================
  //                        MONTHLY (raw SQL)
  // ============================================================

  /**
   * monthlyJobs()
   * Statistik jumlah lowongan per bulan (12 bulan terakhir bila
   * filter kosong). Memakai date_trunc PostgreSQL.
   */
  async monthlyJobs(filter: DashboardFilterDto): Promise<MonthlyBucket[]> {
    return this.monthlyAggregate('jobs', 'createdAt', filter);
  }

  /**
   * monthlyApplications()
   * Statistik jumlah lamaran per bulan.
   */
  async monthlyApplications(
    filter: DashboardFilterDto,
    scope: { companyId?: string; jobSeekerId?: string } = {},
  ): Promise<MonthlyBucket[]> {
    return this.monthlyAggregate('applications', 'appliedAt', filter, scope);
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * regionStats()
   * Group by district / village untuk job_seekers / companies.
   * (Tanpa join nama region karena tabel region akan ditambah di
   * RegionsModule. Return raw key + count.)
   */
  private async regionStats(
    type: 'jobSeekersByDistrict' | 'jobSeekersByVillage' | 'companiesByDistrict' | 'companiesByVillage',
  ) {
    if (type === 'jobSeekersByDistrict') {
      const r = await this.prisma.jobSeeker.groupBy({
        by: ['districtId'],
        where: { deletedAt: null, districtId: { not: null } },
        _count: { _all: true },
      });
      return r.map((g) => ({ districtId: g.districtId, total: g._count._all }));
    }
    if (type === 'jobSeekersByVillage') {
      const r = await this.prisma.jobSeeker.groupBy({
        by: ['villageId'],
        where: { deletedAt: null, villageId: { not: null } },
        _count: { _all: true },
      });
      return r.map((g) => ({ villageId: g.villageId, total: g._count._all }));
    }
    if (type === 'companiesByDistrict') {
      const r = await this.prisma.company.groupBy({
        by: ['districtId'],
        where: { deletedAt: null, districtId: { not: null } },
        _count: { _all: true },
      });
      return r.map((g) => ({ districtId: g.districtId, total: g._count._all }));
    }
    const r = await this.prisma.company.groupBy({
      by: ['villageId'],
      where: { deletedAt: null, villageId: { not: null } },
      _count: { _all: true },
    });
    return r.map((g) => ({ villageId: g.villageId, total: g._count._all }));
  }

  /**
   * monthlyAggregate()
   * Hitung jumlah baris per bulan untuk tabel & kolom tanggal tertentu.
   * Default rentang: 12 bulan terakhir bila filter kosong.
   */
  private async monthlyAggregate(
    table: 'jobs' | 'applications',
    dateColumn: 'createdAt' | 'appliedAt',
    filter: DashboardFilterDto,
    scope: { companyId?: string; jobSeekerId?: string } = {},
  ): Promise<MonthlyBucket[]> {
    const { start, end } = this.parseRange(filter, { defaultLastMonths: 12 });
    const startDate = start ?? new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const endDate = end ?? new Date();

    // Map kolom Prisma → kolom DB (snake_case bila berbeda)
    // Pada schema kita, semua tetap camelCase di DB → gunakan
    // identifier camelCase di-quote.
    const dateCol = `"${dateColumn}"`;
    const tableName = table === 'jobs' ? 'jobs' : 'applications';

    let scopeSql = Prisma.empty;
    if (table === 'applications') {
      if (scope.companyId) {
        scopeSql = Prisma.sql`
          AND a."jobId" IN (SELECT id FROM "jobs" WHERE "companyId" = ${scope.companyId})
        `;
      }
      if (scope.jobSeekerId) {
        scopeSql = Prisma.sql`AND a."jobSeekerId" = ${scope.jobSeekerId}`;
      }
    }

    const rows = await this.prisma.$queryRaw<{ month: Date; count: bigint }[]>(
      table === 'applications'
        ? Prisma.sql`
            SELECT date_trunc('month', a.${Prisma.raw(dateCol)}) AS month,
                   COUNT(*)::int AS count
            FROM "applications" a
            WHERE a."deletedAt" IS NULL
              AND a.${Prisma.raw(dateCol)} >= ${startDate}
              AND a.${Prisma.raw(dateCol)} < ${endDate}
              ${scopeSql}
            GROUP BY 1
            ORDER BY 1 ASC
          `
        : Prisma.sql`
            SELECT date_trunc('month', ${Prisma.raw(dateCol)}) AS month,
                   COUNT(*)::int AS count
            FROM ${Prisma.raw(`"${tableName}"`)}
            WHERE "deletedAt" IS NULL
              AND ${Prisma.raw(dateCol)} >= ${startDate}
              AND ${Prisma.raw(dateCol)} < ${endDate}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
    );

    return rows.map((r) => ({
      month: new Date(r.month).toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  /**
   * resolveActorCompany()
   */
  private async resolveActorCompany(actor: AuthUser): Promise<Company> {
    if (actor.role === 'COMPANY') {
      const c = await this.prisma.company.findFirst({
        where: { userId: actor.id, deletedAt: null },
      });
      if (!c) throw new NotFoundException('Profil perusahaan belum dibuat');
      return c;
    }
    if (actor.role === 'HRD') {
      const member = await this.prisma.companyHrd.findFirst({
        where: { userId: actor.id, company: { deletedAt: null } },
        include: { company: true },
      });
      if (!member) throw new NotFoundException('Anda belum terdaftar sebagai HRD');
      return member.company;
    }
    if (ADMIN_ROLES.has(actor.role)) {
      // Admin tanpa konteks perusahaan tidak boleh memanggil endpoint
      // company-specific tanpa parameter.
      throw new ForbiddenException('Admin perlu memilih perusahaan secara eksplisit');
    }
    throw new ForbiddenException('Role Anda tidak memiliki dashboard perusahaan');
  }

  /**
   * parseRange()
   * Konversi filter ISO date string → Date objects.
   */
  private parseRange(
    filter: DashboardFilterDto,
    opts: { defaultLastMonths?: number } = {},
  ): DateRange {
    const start = filter.startDate ? new Date(filter.startDate) : undefined;
    const end = filter.endDate ? this.endOfDay(new Date(filter.endDate)) : undefined;
    if (!start && opts.defaultLastMonths) {
      const d = new Date();
      d.setMonth(d.getMonth() - opts.defaultLastMonths);
      return { start: d, end };
    }
    return { start, end };
  }

  private endOfDay(d: Date): Date {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  }

  /**
   * dateFilter()
   * Builder klausa Prisma `{ [field]: { gte, lte } }` jika ada range.
   */
  private dateFilter(field: 'createdAt' | 'appliedAt', range: DateRange): Record<string, unknown> {
    if (!range.start && !range.end) return {};
    const cond: Record<string, Date> = {};
    if (range.start) cond.gte = range.start;
    if (range.end) cond.lte = range.end;
    return { [field]: cond };
  }
}
