/**
 * File: backend/src/modules/jobs/jobs.service.ts
 * Fungsi:
 *  - Logika bisnis CRUD lowongan, publish/close/draft, manage
 *    job_skills, list aktif, list milik perusahaan, rekomendasi.
 *  - Otorisasi:
 *      * SUPER_ADMIN/ADMIN_DINAS: full akses.
 *      * COMPANY: hanya lowongan perusahaan yang ia miliki (1-1 user→company).
 *      * HRD: hanya lowongan perusahaan tempat ia terdaftar di company_hrds.
 *      * JOB_SEEKER & public: hanya lowongan aktif (PUBLISHED + deadline > now).
 *  - Publish hanya boleh bila Company.verificationStatus = VERIFIED.
 *  - Lowongan dengan deadline lewat otomatis dianggap EXPIRED:
 *      * pada list aktif: difilter.
 *      * pada detail/publish/close: bila terdeteksi expired, status diupdate.
 *  - Audit log untuk semua aksi mutatif.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Company,
  Job,
  JobStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import { AddJobSkillDto } from './dto/add-job-skill.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { FilterJobDto } from './dto/filter-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

/**
 * Include detail Job (untuk endpoint detail/owner list).
 */
const fullInclude = {
  company: {
    select: {
      id: true,
      companyName: true,
      logoFile: true,
      verificationStatus: true,
      isActive: true,
    },
  },
  jobCategory: true,
  skills: { include: { skill: true } },
} satisfies Prisma.JobInclude;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * List lowongan untuk admin / pencarian umum.
   * Untuk user non-admin yg memanggil tanpa companyId, hasil tetap
   * difilter berdasarkan status PUBLISHED + belum expired.
   */
  async list(query: FilterJobDto, actor?: AuthUser): Promise<PaginatedResult<Job>> {
    const params = getPaginationParams(query);

    const isAdmin = actor && ADMIN_ROLES.has(actor.role);
    const where = this.buildWhere(query, params.search, !isAdmin);

    const orderBy: Prisma.JobOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { createdAt: params.order };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          company: {
            select: { id: true, companyName: true, logoFile: true, verificationStatus: true },
          },
          jobCategory: { select: { id: true, name: true, slug: true } },
          skills: { include: { skill: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * listActive()
   * Publik / pencari kerja: hanya yang PUBLISHED + deadline > now.
   */
  async listActive(query: FilterJobDto): Promise<PaginatedResult<Job>> {
    const params = getPaginationParams(query);
    const where = this.buildWhere(query, params.search, true);

    const orderBy: Prisma.JobOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { publishedAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          company: { select: { id: true, companyName: true, logoFile: true } },
          jobCategory: { select: { id: true, name: true, slug: true } },
          skills: { include: { skill: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * listMyCompany()
   * Lowongan milik perusahaan akun login (COMPANY / HRD).
   */
  async listMyCompany(query: FilterJobDto, actor: AuthUser): Promise<PaginatedResult<Job>> {
    const company = await this.resolveActorCompany(actor);

    const params = getPaginationParams(query);
    const where: Prisma.JobWhereInput = {
      ...this.buildWhere(query, params.search, false),
      companyId: company.id,
    };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: fullInclude,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * recommended()
   * Rekomendasi sederhana untuk JOB_SEEKER yang sudah punya skill di
   * profilnya: lowongan PUBLISHED aktif yang punya overlap skill,
   * diurutkan berdasarkan jumlah skill yang cocok.
   */
  async recommended(actor: AuthUser, query: FilterJobDto): Promise<PaginatedResult<Job>> {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { userId: actor.id, deletedAt: null },
      include: { skills: { select: { skillId: true } } },
    });

    if (!profile || profile.skills.length === 0) {
      // Fallback: jika tidak ada skill, kembalikan list aktif biasa.
      return this.listActive(query);
    }

    const skillIds = profile.skills.map((s) => s.skillId);
    const params = getPaginationParams(query);

    const where: Prisma.JobWhereInput = {
      ...this.buildWhere(query, params.search, true),
      skills: { some: { skillId: { in: skillIds } } },
    };

    // Fetch kandidat lalu hitung match count di memori (sederhana).
    const candidates = await this.prisma.job.findMany({
      where,
      include: {
        company: { select: { id: true, companyName: true, logoFile: true } },
        jobCategory: { select: { id: true, name: true } },
        skills: { include: { skill: true } },
      },
      take: 200, // batas atas untuk efisiensi
    });

    const skillSet = new Set(skillIds);
    const scored = candidates
      .map((job) => ({
        job,
        matched: job.skills.filter((js) => skillSet.has(js.skillId)).length,
      }))
      .sort((a, b) => b.matched - a.matched);

    const total = scored.length;
    const paged = scored.slice(params.skip, params.skip + params.take).map((s) => ({
      ...s.job,
      matchedSkills: s.matched,
    }));

    return {
      data: paged as unknown as Job[],
      meta: buildPaginationMeta(total, params.page, params.limit),
    };
  }

  /**
   * findById()
   * Detail lowongan dengan kontrol akses.
   */
  async findById(id: string, actor?: AuthUser): Promise<Job> {
    const job = await this.prisma.job.findFirst({
      where: { id, deletedAt: null },
      include: fullInclude,
    });
    if (!job) throw new NotFoundException('Lowongan tidak ditemukan');

    // Auto-expire bila terdeteksi
    const finalJob = await this.ensureExpiry(job);

    await this.assertCanView(finalJob, actor);
    return finalJob;
  }

  // ============================================================
  //                             WRITE
  // ============================================================

  /**
   * create()
   * Buat lowongan baru. companyId di-resolve otomatis untuk
   * COMPANY/HRD; admin wajib kirim companyId.
   * Status default DRAFT.
   */
  async create(dto: CreateJobDto, actor: AuthUser, ctx: RequestContext): Promise<Job> {
    const company = await this.resolveCompanyForCreate(dto.companyId, actor);

    this.validateSalaryRange(dto.salaryMin, dto.salaryMax);

    const created = await this.prisma.job.create({
      data: {
        companyId: company.id,
        title: dto.title,
        description: dto.description,
        requirement: dto.requirement,
        responsibility: dto.responsibility,
        jobCategoryId: dto.jobCategoryId,
        employmentType: dto.employmentType,
        workType: dto.workType,
        minimumEducation: dto.minimumEducation,
        minimumExperience: dto.minimumExperience,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryVisible: dto.salaryVisible ?? true,
        provinceId: dto.provinceId,
        regencyId: dto.regencyId,
        districtId: dto.districtId,
        villageId: dto.villageId,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        quota: dto.quota,
        status: JobStatus.DRAFT,
      },
      include: fullInclude,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_CREATE',
      entity: 'Job',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return created;
  }

  /**
   * update()
   * Update lowongan. Hanya owner perusahaan / admin.
   * Tidak boleh update lowongan yang sudah CLOSED.
   */
  async update(
    id: string,
    dto: UpdateJobDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Job> {
    const job = await this.getManageable(id, actor);

    if (job.status === JobStatus.CLOSED) {
      throw new BadRequestException('Lowongan yang sudah CLOSED tidak dapat diubah');
    }

    this.validateSalaryRange(
      dto.salaryMin ?? Number(job.salaryMin ?? 0),
      dto.salaryMax ?? Number(job.salaryMax ?? 0),
    );

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: fullInclude,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_UPDATE',
      entity: 'Job',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete.
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    await this.getManageable(id, actor);

    await this.prisma.job.update({
      where: { id },
      data: { deletedAt: new Date(), status: JobStatus.CLOSED, closedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_DELETE',
      entity: 'Job',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * publish()
   * Aktifkan lowongan menjadi PUBLISHED.
   * Syarat:
   *  - Perusahaan VERIFIED & aktif.
   *  - Deadline (bila ada) > now.
   */
  async publish(id: string, actor: AuthUser, ctx: RequestContext): Promise<Job> {
    const job = await this.getManageable(id, actor);
    const company = await this.prisma.company.findUnique({ where: { id: job.companyId } });

    if (!company || company.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException('Perusahaan harus VERIFIED sebelum publish lowongan');
    }
    if (!company.isActive) {
      throw new BadRequestException('Perusahaan sedang nonaktif');
    }
    if (job.deadline && job.deadline < new Date()) {
      throw new BadRequestException('Deadline lowongan sudah lewat');
    }

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.PUBLISHED, publishedAt: new Date(), closedAt: null },
      include: fullInclude,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_PUBLISH',
      entity: 'Job',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /**
   * close()
   * Tutup lowongan (CLOSED).
   */
  async close(id: string, actor: AuthUser, ctx: RequestContext): Promise<Job> {
    await this.getManageable(id, actor);

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.CLOSED, closedAt: new Date() },
      include: fullInclude,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_CLOSE',
      entity: 'Job',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /**
   * draft()
   * Pindahkan lowongan kembali ke DRAFT.
   */
  async draft(id: string, actor: AuthUser, ctx: RequestContext): Promise<Job> {
    await this.getManageable(id, actor);

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.DRAFT, publishedAt: null, closedAt: null },
      include: fullInclude,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_DRAFT',
      entity: 'Job',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  // ============================================================
  //                          JOB SKILLS
  // ============================================================

  /**
   * addSkill()
   * Tambah skill ke lowongan. Bila skillName diberikan, find-or-create.
   */
  async addSkill(
    jobId: string,
    dto: AddJobSkillDto,
    actor: AuthUser,
    ctx: RequestContext,
  ) {
    await this.getManageable(jobId, actor);

    if (!dto.skillId && !dto.skillName) {
      throw new BadRequestException('skillId atau skillName wajib diisi');
    }

    let skillId = dto.skillId;
    if (!skillId && dto.skillName) {
      const name = dto.skillName.trim();
      const existing = await this.prisma.skill.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
      });
      skillId = existing ? existing.id : (await this.prisma.skill.create({ data: { name } })).id;
    }
    if (!skillId) throw new BadRequestException('Skill tidak valid');

    const dup = await this.prisma.jobSkill.findUnique({
      where: { jobId_skillId: { jobId, skillId } },
    });
    if (dup) throw new ConflictException('Skill sudah terdaftar pada lowongan ini');

    const link = await this.prisma.jobSkill.create({
      data: {
        jobId,
        skillId,
        level: dto.level,
        isRequired: dto.isRequired ?? true,
      },
      include: { skill: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_ADD_SKILL',
      entity: 'Job',
      entityId: jobId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { skillId, level: dto.level, isRequired: dto.isRequired },
    });

    return link;
  }

  async removeSkill(
    jobId: string,
    skillId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.getManageable(jobId, actor);

    const link = await this.prisma.jobSkill.findUnique({
      where: { jobId_skillId: { jobId, skillId } },
    });
    if (!link) throw new NotFoundException('Skill tidak terhubung dengan lowongan ini');

    await this.prisma.jobSkill.delete({ where: { jobId_skillId: { jobId, skillId } } });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_REMOVE_SKILL',
      entity: 'Job',
      entityId: jobId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { skillId },
    });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * buildWhere()
   * Bangun klausa where umum berdasarkan filter + search.
   * @param activeOnly Jika true, paksa status PUBLISHED & deadline aktif.
   */
  private buildWhere(
    query: FilterJobDto,
    search: string | undefined,
    activeOnly: boolean,
  ): Prisma.JobWhereInput {
    const baseSalary: Prisma.JobWhereInput = {};
    if (query.salaryMin !== undefined) baseSalary.salaryMax = { gte: query.salaryMin };
    if (query.salaryMax !== undefined) baseSalary.salaryMin = { lte: query.salaryMax };

    const where: Prisma.JobWhereInput = {
      deletedAt: null,
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.jobCategoryId && { jobCategoryId: query.jobCategoryId }),
      ...(query.employmentType && { employmentType: query.employmentType }),
      ...(query.workType && { workType: query.workType }),
      ...(query.provinceId && { provinceId: query.provinceId }),
      ...(query.regencyId && { regencyId: query.regencyId }),
      ...(query.districtId && { districtId: query.districtId }),
      ...(query.villageId && { villageId: query.villageId }),
      ...(query.minimumEducation && { minimumEducation: query.minimumEducation }),
      ...(query.minimumExperience !== undefined && {
        minimumExperience: { lte: query.minimumExperience },
      }),
      ...(query.skillId && { skills: { some: { skillId: query.skillId } } }),
      ...baseSalary,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { company: { companyName: { contains: search, mode: 'insensitive' } } },
          {
            skills: {
              some: { skill: { name: { contains: search, mode: 'insensitive' } } },
            },
          },
        ],
      }),
    };

    if (activeOnly) {
      where.status = JobStatus.PUBLISHED;
      where.OR = [
        ...((where.OR as Prisma.JobWhereInput[]) ?? []),
      ];
      // deadline kosong atau di masa depan
      where.AND = [
        { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
      ];
      // Pastikan perusahaan verified & aktif
      where.company = { verificationStatus: VerificationStatus.VERIFIED, isActive: true };
    } else if (query.status) {
      where.status = query.status;
    }

    return where;
  }

  /**
   * ensureExpiry()
   * Jika lowongan PUBLISHED tapi deadline sudah lewat, set status EXPIRED.
   */
  private async ensureExpiry(job: Job): Promise<Job> {
    if (
      job.status === JobStatus.PUBLISHED &&
      job.deadline &&
      job.deadline < new Date()
    ) {
      return this.prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.EXPIRED, closedAt: new Date() },
        include: fullInclude,
      });
    }
    return job;
  }

  /**
   * getManageable()
   * Ambil lowongan untuk diubah. Hanya owner (COMPANY/HRD) atau admin.
   */
  private async getManageable(id: string, actor: AuthUser): Promise<Job> {
    const job = await this.prisma.job.findFirst({
      where: { id, deletedAt: null },
    });
    if (!job) throw new NotFoundException('Lowongan tidak ditemukan');

    if (ADMIN_ROLES.has(actor.role)) return job;

    const company = await this.resolveActorCompany(actor).catch(() => null);
    if (company && company.id === job.companyId) return job;

    throw new ForbiddenException('Anda tidak berhak memodifikasi lowongan ini');
  }

  /**
   * resolveCompanyForCreate()
   * Tentukan companyId saat create:
   *  - Admin: pakai dto.companyId (wajib).
   *  - COMPANY/HRD: pakai perusahaan miliknya (override dto).
   */
  private async resolveCompanyForCreate(
    explicitCompanyId: string | undefined,
    actor: AuthUser,
  ): Promise<Company> {
    if (ADMIN_ROLES.has(actor.role)) {
      if (!explicitCompanyId) {
        throw new BadRequestException('companyId wajib diisi oleh admin');
      }
      const company = await this.prisma.company.findFirst({
        where: { id: explicitCompanyId, deletedAt: null },
      });
      if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');
      return company;
    }

    return this.resolveActorCompany(actor);
  }

  /**
   * resolveActorCompany()
   * Cari perusahaan milik actor (COMPANY: owner; HRD: anggota).
   */
  private async resolveActorCompany(actor: AuthUser): Promise<Company> {
    if (actor.role === 'COMPANY') {
      const company = await this.prisma.company.findFirst({
        where: { userId: actor.id, deletedAt: null },
      });
      if (!company) throw new NotFoundException('Profil perusahaan belum dibuat');
      return company;
    }

    if (actor.role === 'HRD') {
      const membership = await this.prisma.companyHrd.findFirst({
        where: { userId: actor.id, company: { deletedAt: null } },
        include: { company: true },
      });
      if (!membership) {
        throw new ForbiddenException('Anda belum terdaftar sebagai HRD perusahaan');
      }
      return membership.company;
    }

    throw new ForbiddenException('Role Anda tidak dapat mengelola lowongan');
  }

  /**
   * assertCanView()
   * Aturan akses detail lowongan:
   *  - Tanpa actor (public): hanya PUBLISHED + perusahaan VERIFIED + aktif + tidak expired.
   *  - Admin: bebas.
   *  - COMPANY/HRD: hanya lowongan perusahaan mereka.
   *  - JOB_SEEKER/LEADER/lainnya: sama seperti public.
   */
  private async assertCanView(job: Job, actor?: AuthUser): Promise<void> {
    if (actor && ADMIN_ROLES.has(actor.role)) return;

    if (actor && (actor.role === 'COMPANY' || actor.role === 'HRD')) {
      const company = await this.resolveActorCompany(actor).catch(() => null);
      if (company && company.id === job.companyId) return;
    }

    const company = await this.prisma.company.findUnique({ where: { id: job.companyId } });
    const isCompanyOk =
      !!company &&
      company.verificationStatus === VerificationStatus.VERIFIED &&
      company.isActive;
    const isJobOk =
      job.status === JobStatus.PUBLISHED &&
      (!job.deadline || job.deadline > new Date());

    if (isCompanyOk && isJobOk) return;
    throw new ForbiddenException('Anda tidak berhak melihat lowongan ini');
  }

  /**
   * validateSalaryRange()
   */
  private validateSalaryRange(min?: number | null, max?: number | null): void {
    if (min !== undefined && min !== null && max !== undefined && max !== null) {
      if (Number(min) > Number(max)) {
        throw new BadRequestException('salaryMin tidak boleh lebih besar dari salaryMax');
      }
    }
  }
}
