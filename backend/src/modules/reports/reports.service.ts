/**
 * File: backend/src/modules/reports/reports.service.ts
 * Fungsi:
 *  - Logika bisnis pembuatan laporan:
 *      list (paginated, untuk view), rows (untuk export, dibatasi
 *      cap aman), build PDF/Excel via util.
 *  - Audit log pada setiap export.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { buildExcelBuffer, ExcelColumn } from './utils/export-excel.util';
import { buildPdfBuffer, PdfColumn } from './utils/export-pdf.util';

/**
 * Maksimum baris untuk satu kali export (safety cap).
 */
const EXPORT_HARD_LIMIT = 10_000;

const EXPORT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER']);

export interface ExportPayload {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                            LIST (JSON)
  // ============================================================

  async listJobSeekers(filter: ReportFilterDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(filter);
    const where = this.jobSeekerWhere(filter);

    const [data, total] = await Promise.all([
      this.prisma.jobSeeker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.jobSeeker.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  async listCompanies(filter: ReportFilterDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(filter);
    const where = this.companyWhere(filter);

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  async listJobs(filter: ReportFilterDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(filter);
    const where = this.jobWhere(filter);

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          company: { select: { id: true, companyName: true } },
          jobCategory: { select: { id: true, name: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  async listApplications(filter: ReportFilterDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(filter);
    const where = this.applicationWhere(filter);

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          jobSeeker: { select: { id: true, fullName: true } },
          job: {
            select: {
              id: true,
              title: true,
              company: { select: { id: true, companyName: true } },
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  async listInterviews(filter: ReportFilterDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(filter);
    const where: Prisma.InterviewWhereInput = {
      ...(filter.startDate || filter.endDate
        ? { scheduledAt: this.dateBetween(filter.startDate, filter.endDate) }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          application: {
            select: {
              id: true,
              status: true,
              jobSeeker: { select: { id: true, fullName: true } },
              job: { select: { id: true, title: true, companyId: true } },
            },
          },
        },
      }),
      this.prisma.interview.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * regionsReport()
   * Total pencari kerja & perusahaan per district & village.
   */
  async regionsReport() {
    const [jsDistrict, jsVillage, coDistrict, coVillage] = await Promise.all([
      this.prisma.jobSeeker.groupBy({
        by: ['districtId'],
        where: { deletedAt: null, districtId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.jobSeeker.groupBy({
        by: ['villageId'],
        where: { deletedAt: null, villageId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.company.groupBy({
        by: ['districtId'],
        where: { deletedAt: null, districtId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.company.groupBy({
        by: ['villageId'],
        where: { deletedAt: null, villageId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return {
      jobSeekersByDistrict: jsDistrict.map((g) => ({ districtId: g.districtId, total: g._count._all })),
      jobSeekersByVillage: jsVillage.map((g) => ({ villageId: g.villageId, total: g._count._all })),
      companiesByDistrict: coDistrict.map((g) => ({ districtId: g.districtId, total: g._count._all })),
      companiesByVillage: coVillage.map((g) => ({ villageId: g.villageId, total: g._count._all })),
    };
  }

  /**
   * skillsReport()
   * Top skill yang dimiliki pencari kerja & dibutuhkan lowongan.
   */
  async skillsReport(limit = 20) {
    const [jsGroup, jobGroup] = await Promise.all([
      this.prisma.jobSeekerSkill.groupBy({
        by: ['skillId'],
        _count: { _all: true },
        orderBy: { _count: { skillId: 'desc' } },
        take: limit,
      }),
      this.prisma.jobSkill.groupBy({
        by: ['skillId'],
        _count: { _all: true },
        orderBy: { _count: { skillId: 'desc' } },
        take: limit,
      }),
    ]);

    const ids = Array.from(new Set([...jsGroup, ...jobGroup].map((g) => g.skillId)));
    const skills = ids.length
      ? await this.prisma.skill.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const map = new Map(skills.map((s) => [s.id, s.name]));

    return {
      topJobSeekerSkills: jsGroup.map((g) => ({
        skillId: g.skillId,
        skill: map.get(g.skillId) ?? 'UNKNOWN',
        total: g._count._all,
      })),
      topJobSkills: jobGroup.map((g) => ({
        skillId: g.skillId,
        skill: map.get(g.skillId) ?? 'UNKNOWN',
        total: g._count._all,
      })),
    };
  }

  // ============================================================
  //                           EXPORT
  // ============================================================

  /**
   * exportJobSeekers()
   * Bangun PDF/Excel pencari kerja sesuai filter + audit log.
   */
  async exportJobSeekers(
    format: 'pdf' | 'excel',
    filter: ReportFilterDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<ExportPayload> {
    this.assertExporter(actor);
    const where = this.jobSeekerWhere(filter);
    const rows = await this.prisma.jobSeeker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_HARD_LIMIT,
      include: { user: { select: { email: true, fullName: true } } },
    });

    const mapped = rows.map((r) => ({
      fullName: r.fullName,
      email: r.user.email,
      nik: r.nik,
      gender: r.gender,
      phone: r.phone,
      lastEducation: r.lastEducation,
      major: r.major,
      workStatus: r.workStatus,
      provinceId: r.provinceId,
      districtId: r.districtId,
      villageId: r.villageId,
      createdAt: r.createdAt,
    }));

    const columns: ExcelColumn[] = [
      { header: 'Nama', key: 'fullName', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'NIK', key: 'nik', width: 18 },
      { header: 'Gender', key: 'gender', width: 8 },
      { header: 'HP', key: 'phone', width: 16 },
      { header: 'Pendidikan', key: 'lastEducation', width: 12 },
      { header: 'Jurusan', key: 'major', width: 20 },
      { header: 'Status Kerja', key: 'workStatus', width: 16 },
      { header: 'Provinsi', key: 'provinceId', width: 14 },
      { header: 'Kecamatan', key: 'districtId', width: 14 },
      { header: 'Desa', key: 'villageId', width: 14 },
      { header: 'Tgl Daftar', key: 'createdAt', width: 18 },
    ];

    const payload = await this.export(
      format,
      'Laporan Pencari Kerja',
      this.subtitleFromFilter(filter),
      columns,
      mapped,
      { 'Total Pencari Kerja': mapped.length },
      'job-seekers',
    );

    await this.audit.write({
      userId: actor.id,
      action: `REPORT_EXPORT_JOB_SEEKERS_${format.toUpperCase()}`,
      entity: 'Report',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { count: mapped.length },
    });

    return payload;
  }

  async exportCompanies(
    format: 'pdf' | 'excel',
    filter: ReportFilterDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<ExportPayload> {
    this.assertExporter(actor);
    const where = this.companyWhere(filter);
    const rows = await this.prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_HARD_LIMIT,
      include: { user: { select: { email: true } } },
    });

    const mapped = rows.map((r) => ({
      companyName: r.companyName,
      email: r.email ?? r.user?.email,
      businessField: r.businessField,
      verificationStatus: r.verificationStatus,
      isActive: r.isActive ? 'YA' : 'TIDAK',
      provinceId: r.provinceId,
      districtId: r.districtId,
      villageId: r.villageId,
      createdAt: r.createdAt,
    }));

    const columns: ExcelColumn[] = [
      { header: 'Nama Perusahaan', key: 'companyName', width: 28 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Bidang', key: 'businessField', width: 20 },
      { header: 'Verifikasi', key: 'verificationStatus', width: 14 },
      { header: 'Aktif', key: 'isActive', width: 8 },
      { header: 'Provinsi', key: 'provinceId', width: 14 },
      { header: 'Kecamatan', key: 'districtId', width: 14 },
      { header: 'Desa', key: 'villageId', width: 14 },
      { header: 'Tgl Daftar', key: 'createdAt', width: 18 },
    ];

    const payload = await this.export(
      format,
      'Laporan Perusahaan',
      this.subtitleFromFilter(filter),
      columns,
      mapped,
      { 'Total Perusahaan': mapped.length },
      'companies',
    );

    await this.audit.write({
      userId: actor.id,
      action: `REPORT_EXPORT_COMPANIES_${format.toUpperCase()}`,
      entity: 'Report',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { count: mapped.length },
    });

    return payload;
  }

  async exportJobs(
    format: 'pdf' | 'excel',
    filter: ReportFilterDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<ExportPayload> {
    this.assertExporter(actor);
    const where = this.jobWhere(filter);
    const rows = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_HARD_LIMIT,
      include: {
        company: { select: { companyName: true } },
        jobCategory: { select: { name: true } },
      },
    });

    const mapped = rows.map((r) => ({
      title: r.title,
      company: r.company?.companyName,
      category: r.jobCategory?.name,
      employmentType: r.employmentType,
      workType: r.workType,
      status: r.status,
      salaryMin: r.salaryMin,
      salaryMax: r.salaryMax,
      deadline: r.deadline,
      createdAt: r.createdAt,
    }));

    const columns: ExcelColumn[] = [
      { header: 'Judul', key: 'title', width: 32 },
      { header: 'Perusahaan', key: 'company', width: 24 },
      { header: 'Kategori', key: 'category', width: 18 },
      { header: 'Jenis', key: 'employmentType', width: 12 },
      { header: 'Tempat', key: 'workType', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Gaji Min', key: 'salaryMin', width: 14 },
      { header: 'Gaji Max', key: 'salaryMax', width: 14 },
      { header: 'Deadline', key: 'deadline', width: 18 },
      { header: 'Tgl Buat', key: 'createdAt', width: 18 },
    ];

    const payload = await this.export(
      format,
      'Laporan Lowongan Kerja',
      this.subtitleFromFilter(filter),
      columns,
      mapped,
      { 'Total Lowongan': mapped.length },
      'jobs',
    );

    await this.audit.write({
      userId: actor.id,
      action: `REPORT_EXPORT_JOBS_${format.toUpperCase()}`,
      entity: 'Report',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { count: mapped.length },
    });

    return payload;
  }

  async exportApplications(
    format: 'pdf' | 'excel',
    filter: ReportFilterDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<ExportPayload> {
    this.assertExporter(actor);
    const where = this.applicationWhere(filter);
    const rows = await this.prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      take: EXPORT_HARD_LIMIT,
      include: {
        jobSeeker: { select: { fullName: true } },
        job: {
          select: {
            title: true,
            company: { select: { companyName: true } },
          },
        },
      },
    });

    const mapped = rows.map((r) => ({
      applicant: r.jobSeeker.fullName,
      jobTitle: r.job.title,
      company: r.job.company?.companyName,
      status: r.status,
      appliedAt: r.appliedAt,
      reviewedAt: r.reviewedAt,
    }));

    const columns: ExcelColumn[] = [
      { header: 'Pelamar', key: 'applicant', width: 24 },
      { header: 'Lowongan', key: 'jobTitle', width: 28 },
      { header: 'Perusahaan', key: 'company', width: 24 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Tgl Lamar', key: 'appliedAt', width: 18 },
      { header: 'Tgl Review', key: 'reviewedAt', width: 18 },
    ];

    const payload = await this.export(
      format,
      'Laporan Lamaran Kerja',
      this.subtitleFromFilter(filter),
      columns,
      mapped,
      { 'Total Lamaran': mapped.length },
      'applications',
    );

    await this.audit.write({
      userId: actor.id,
      action: `REPORT_EXPORT_APPLICATIONS_${format.toUpperCase()}`,
      entity: 'Report',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { count: mapped.length },
    });

    return payload;
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * export()
   * Wrapper umum: dispatch ke buildPdfBuffer atau buildExcelBuffer
   * sesuai format, lalu hasilkan filename yang konsisten.
   */
  private async export(
    format: 'pdf' | 'excel',
    title: string,
    subtitle: string | undefined,
    columns: ExcelColumn[],
    rows: Record<string, unknown>[],
    summary: Record<string, string | number>,
    slug: string,
  ): Promise<ExportPayload> {
    const stamp = dayjs().format('YYYYMMDD-HHmm');

    if (format === 'excel') {
      const buffer = await buildExcelBuffer({
        title,
        subtitle,
        columns,
        rows,
        summary,
        sheetName: 'Laporan',
      });
      return {
        buffer,
        filename: `${slug}-${stamp}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    // PDF columns: gunakan width default proporsional jika tidak diset
    const pdfColumns: PdfColumn[] = this.toPdfColumns(columns);
    const buffer = await buildPdfBuffer({
      title,
      subtitle,
      columns: pdfColumns,
      rows,
      summary,
    });
    return {
      buffer,
      filename: `${slug}-${stamp}.pdf`,
      contentType: 'application/pdf',
    };
  }

  /**
   * toPdfColumns()
   * Konversi ExcelColumn → PdfColumn dengan estimasi width (point).
   */
  private toPdfColumns(columns: ExcelColumn[]): PdfColumn[] {
    const total = columns.reduce((a, c) => a + (c.width ?? 12), 0);
    // Lebar konten yang tersedia di A4 landscape minus margins.
    const available = 842 - 64;
    return columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(40, Math.floor(((c.width ?? 12) / total) * available)),
    }));
  }

  private assertExporter(actor: AuthUser): void {
    if (!EXPORT_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin / pimpinan yang dapat export laporan');
    }
  }

  private dateBetween(start?: string, end?: string): { gte?: Date; lte?: Date } {
    const out: { gte?: Date; lte?: Date } = {};
    if (start) out.gte = new Date(start);
    if (end) {
      const e = new Date(end);
      e.setHours(23, 59, 59, 999);
      out.lte = e;
    }
    return out;
  }

  private subtitleFromFilter(filter: ReportFilterDto): string | undefined {
    const parts: string[] = [];
    if (filter.startDate) parts.push(`Dari ${filter.startDate}`);
    if (filter.endDate) parts.push(`Sampai ${filter.endDate}`);
    if (filter.provinceId) parts.push(`Provinsi: ${filter.provinceId}`);
    if (filter.districtId) parts.push(`Kecamatan: ${filter.districtId}`);
    if (filter.villageId) parts.push(`Desa: ${filter.villageId}`);
    if (filter.applicationStatus) parts.push(`Status Lamaran: ${filter.applicationStatus}`);
    if (filter.jobStatus) parts.push(`Status Lowongan: ${filter.jobStatus}`);
    if (filter.verificationStatus) parts.push(`Verifikasi: ${filter.verificationStatus}`);
    return parts.length ? parts.join(' • ') : undefined;
  }

  // ---------- where builders ----------

  private jobSeekerWhere(filter: ReportFilterDto): Prisma.JobSeekerWhereInput {
    return {
      deletedAt: null,
      ...(filter.provinceId && { provinceId: filter.provinceId }),
      ...(filter.regencyId && { regencyId: filter.regencyId }),
      ...(filter.districtId && { districtId: filter.districtId }),
      ...(filter.villageId && { villageId: filter.villageId }),
      ...(filter.startDate || filter.endDate
        ? { createdAt: this.dateBetween(filter.startDate, filter.endDate) }
        : {}),
      ...(filter.search && {
        OR: [
          { fullName: { contains: filter.search, mode: 'insensitive' } },
          { nik: { contains: filter.search } },
          { user: { email: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };
  }

  private companyWhere(filter: ReportFilterDto): Prisma.CompanyWhereInput {
    return {
      deletedAt: null,
      ...(filter.verificationStatus && { verificationStatus: filter.verificationStatus }),
      ...(filter.provinceId && { provinceId: filter.provinceId }),
      ...(filter.regencyId && { regencyId: filter.regencyId }),
      ...(filter.districtId && { districtId: filter.districtId }),
      ...(filter.villageId && { villageId: filter.villageId }),
      ...(filter.startDate || filter.endDate
        ? { createdAt: this.dateBetween(filter.startDate, filter.endDate) }
        : {}),
      ...(filter.search && {
        OR: [
          { companyName: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };
  }

  private jobWhere(filter: ReportFilterDto): Prisma.JobWhereInput {
    return {
      deletedAt: null,
      ...(filter.companyId && { companyId: filter.companyId }),
      ...(filter.jobCategoryId && { jobCategoryId: filter.jobCategoryId }),
      ...(filter.employmentType && { employmentType: filter.employmentType }),
      ...(filter.workType && { workType: filter.workType }),
      ...(filter.jobStatus && { status: filter.jobStatus }),
      ...(filter.provinceId && { provinceId: filter.provinceId }),
      ...(filter.regencyId && { regencyId: filter.regencyId }),
      ...(filter.districtId && { districtId: filter.districtId }),
      ...(filter.villageId && { villageId: filter.villageId }),
      ...(filter.startDate || filter.endDate
        ? { createdAt: this.dateBetween(filter.startDate, filter.endDate) }
        : {}),
      ...(filter.search && {
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { company: { companyName: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };
  }

  private applicationWhere(filter: ReportFilterDto): Prisma.ApplicationWhereInput {
    return {
      deletedAt: null,
      ...(filter.applicationStatus && { status: filter.applicationStatus }),
      ...(filter.companyId && { job: { companyId: filter.companyId } }),
      ...(filter.startDate || filter.endDate
        ? { appliedAt: this.dateBetween(filter.startDate, filter.endDate) }
        : {}),
    };
  }
}
