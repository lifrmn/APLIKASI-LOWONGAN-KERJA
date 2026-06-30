/**
 * File: backend/src/modules/applications/applications.service.ts
 * Fungsi:
 *  - Logika bisnis lamaran kerja:
 *      apply, list (admin/owner/company), detail, update status
 *      + history + notifikasi, update note, cancel, soft delete.
 *  - Otorisasi:
 *      * SUPER_ADMIN/ADMIN_DINAS: bebas.
 *      * COMPANY/HRD: hanya lamaran pada lowongan perusahaan mereka.
 *      * JOB_SEEKER: hanya lamarannya sendiri (create, view, cancel).
 *  - Anti-duplicate: cek di service (deletedAt=null + jobId + jobSeekerId).
 *  - Setiap perubahan status → tulis ApplicationStatusHistory + Notification.
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
  Application,
  ApplicationStatus,
  ApplicationStatusHistory,
  JobStatus,
  NotificationType,
  Prisma,
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
import { CreateApplicationDto } from './dto/create-application.dto';
import { FilterApplicationDto } from './dto/filter-application.dto';
import { UpdateApplicationNoteDto } from './dto/update-application-note.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

/**
 * Include detail untuk endpoint detail/list.
 */
const fullInclude = {
  job: {
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      company: { select: { id: true, companyName: true, userId: true, logoFile: true } },
    },
  },
  jobSeeker: {
    select: {
      id: true,
      fullName: true,
      userId: true,
      user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
  cvFile: true,
  reviewedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ApplicationInclude;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Admin: semua lamaran (paginated + filter).
   */
  async list(query: FilterApplicationDto): Promise<PaginatedResult<Application>> {
    const params = getPaginationParams(query);
    const where = this.buildWhere(query, params.search);

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: fullInclude,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * myApplications()
   * Riwayat lamaran milik JOB_SEEKER yang sedang login.
   */
  async myApplications(
    actor: AuthUser,
    query: FilterApplicationDto,
  ): Promise<PaginatedResult<Application>> {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja belum dibuat');

    const params = getPaginationParams(query);
    const where: Prisma.ApplicationWhereInput = {
      ...this.buildWhere(query, params.search),
      jobSeekerId: profile.id,
    };

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: fullInclude,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * listByJob()
   * Daftar pelamar pada satu lowongan. Hanya admin atau
   * COMPANY/HRD pemilik lowongan.
   */
  async listByJob(
    jobId: string,
    query: FilterApplicationDto,
    actor: AuthUser,
  ): Promise<PaginatedResult<Application>> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      include: { company: true },
    });
    if (!job) throw new NotFoundException('Lowongan tidak ditemukan');
    await this.assertCanManageCompanyJob(job.companyId, actor);

    const params = getPaginationParams(query);
    const where: Prisma.ApplicationWhereInput = {
      ...this.buildWhere(query, params.search),
      jobId,
    };

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: fullInclude,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   * Detail lamaran. Akses: owner job-seeker, admin, atau
   * COMPANY/HRD perusahaan pemilik lowongan.
   */
  async findById(id: string, actor: AuthUser) {
    const app = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...fullInclude,
        statusHistories: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        },
        interviews: { orderBy: { scheduledAt: 'desc' } },
      },
    });
    if (!app) throw new NotFoundException('Lamaran tidak ditemukan');
    await this.assertCanViewApplication(app, actor);
    return app;
  }

  /**
   * statusHistories()
   * Daftar riwayat status lamaran.
   */
  async statusHistories(id: string, actor: AuthUser): Promise<ApplicationStatusHistory[]> {
    const app = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
    });
    if (!app) throw new NotFoundException('Lamaran tidak ditemukan');
    await this.assertCanViewApplication(app, actor);

    return this.prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });
  }

  // ============================================================
  //                             WRITE
  // ============================================================

  /**
   * create()
   * Melamar pekerjaan.
   *  - JOB_SEEKER → otomatis pakai profilnya sendiri.
   *  - Admin → wajib kirim jobSeekerId.
   *  - Lowongan harus PUBLISHED, perusahaan VERIFIED+aktif,
   *    deadline belum lewat.
   *  - Anti duplicate: tidak boleh lamar lowongan yang sama 2 kali.
   *  - cvFileId opsional; default pakai CV di profil.
   *  - Otomatis tulis history APPLIED + notifikasi.
   */
  async create(
    dto: CreateApplicationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Application> {
    const jobSeekerId = ADMIN_ROLES.has(actor.role)
      ? dto.jobSeekerId
      : await this.resolveJobSeekerIdForActor(actor);
    if (!jobSeekerId) {
      throw new BadRequestException('jobSeekerId wajib diisi oleh admin');
    }

    const [jobSeeker, job] = await Promise.all([
      this.prisma.jobSeeker.findFirst({
        where: { id: jobSeekerId, deletedAt: null },
        include: { user: { select: { id: true, fullName: true } } },
      }),
      this.prisma.job.findFirst({
        where: { id: dto.jobId, deletedAt: null },
        include: { company: true },
      }),
    ]);

    if (!jobSeeker) throw new NotFoundException('Profil pencari kerja tidak ditemukan');
    if (!job) throw new NotFoundException('Lowongan tidak ditemukan');

    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException('Lowongan tidak sedang dibuka');
    }
    if (job.deadline && job.deadline < new Date()) {
      throw new BadRequestException('Deadline lowongan sudah lewat');
    }
    if (!job.company || !job.company.isActive) {
      throw new BadRequestException('Perusahaan sedang nonaktif');
    }

    // Anti-duplicate (mempertimbangkan deletedAt)
    const dup = await this.prisma.application.findFirst({
      where: { jobId: dto.jobId, jobSeekerId, deletedAt: null },
    });
    if (dup) throw new ConflictException('Anda sudah pernah melamar lowongan ini');

    // Resolusi CV: explicit → fallback ke profil
    let cvFileId = dto.cvFileId ?? jobSeeker.cvFileId ?? null;
    if (dto.cvFileId) {
      const cv = await this.prisma.uploadedFile.findFirst({
        where: { id: dto.cvFileId, deletedAt: null },
      });
      if (!cv) throw new BadRequestException('cvFileId tidak valid');
      cvFileId = cv.id;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          jobId: dto.jobId,
          jobSeekerId,
          coverLetter: dto.coverLetter,
          cvFileId,
          status: ApplicationStatus.APPLIED,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: null,
          toStatus: ApplicationStatus.APPLIED,
          note: 'Lamaran dibuat',
          actorId: actor.id,
        },
      });

      // Notifikasi ke pencari kerja (konfirmasi)
      await tx.notification.create({
        data: {
          userId: jobSeeker.user.id,
          type: NotificationType.APPLICATION_STATUS,
          title: 'Lamaran terkirim',
          message: `Lamaran untuk lowongan "${job.title}" telah berhasil dikirim.`,
          data: { applicationId: app.id, jobId: job.id, status: ApplicationStatus.APPLIED },
        },
      });

      return app;
    });

    await this.audit.write({
      userId: actor.id,
      action: 'APPLICATION_CREATE',
      entity: 'Application',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { jobId: dto.jobId, jobSeekerId },
    });

    return created;
  }

  /**
   * updateStatus()
   * Ubah status lamaran (oleh admin / COMPANY / HRD pemilik lowongan).
   * - Tidak boleh kembali ke APPLIED dari status lain.
   * - Tidak boleh mengubah status lamaran yang sudah CANCELLED.
   * - Bila status INTERVIEW & interviewScheduledAt diisi → buat Interview.
   * - Selalu tulis history + notifikasi.
   */
  async updateStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Application> {
    const app = await this.getForReview(id, actor);

    if (app.status === ApplicationStatus.CANCELLED) {
      throw new BadRequestException('Lamaran sudah dibatalkan');
    }
    if (dto.status === ApplicationStatus.APPLIED) {
      throw new BadRequestException('Tidak dapat mengembalikan status ke APPLIED');
    }
    if (dto.status === ApplicationStatus.CANCELLED) {
      throw new BadRequestException('Gunakan endpoint /cancel untuk membatalkan');
    }
    if (dto.status === app.status) {
      throw new BadRequestException('Status tidak berubah');
    }

    const jobSeeker = await this.prisma.jobSeeker.findUnique({
      where: { id: app.jobSeekerId },
      select: { userId: true, fullName: true },
    });
    const job = await this.prisma.job.findUnique({
      where: { id: app.jobId },
      select: { title: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id },
        data: {
          status: dto.status,
          note: dto.note ?? app.note,
          reviewedAt: new Date(),
          reviewedById: actor.id,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: app.status,
          toStatus: dto.status,
          note: dto.note,
          actorId: actor.id,
        },
      });

      if (dto.status === ApplicationStatus.INTERVIEW && dto.interviewScheduledAt) {
        await tx.interview.create({
          data: {
            applicationId: id,
            scheduledAt: new Date(dto.interviewScheduledAt),
            location: dto.interviewLocation,
            meetingLink: dto.interviewMeetingLink,
            notes: dto.note,
            status: 'SCHEDULED',
          },
        });
      }

      if (jobSeeker) {
        await tx.notification.create({
          data: {
            userId: jobSeeker.userId,
            type:
              dto.status === ApplicationStatus.INTERVIEW
                ? NotificationType.INTERVIEW
                : NotificationType.APPLICATION_STATUS,
            title: this.statusNotificationTitle(dto.status),
            message: `Status lamaran "${job?.title ?? ''}" diperbarui menjadi ${dto.status}.`,
            data: { applicationId: id, status: dto.status },
          },
        });
      }

      return u;
    });

    await this.audit.write({
      userId: actor.id,
      action: 'APPLICATION_UPDATE_STATUS',
      entity: 'Application',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { from: app.status, to: dto.status },
    });

    return updated;
  }

  /**
   * updateNote()
   * Catatan internal reviewer (tidak mengubah status).
   */
  async updateNote(
    id: string,
    dto: UpdateApplicationNoteDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Application> {
    const app = await this.getForReview(id, actor);

    const updated = await this.prisma.application.update({
      where: { id },
      data: { note: dto.note, reviewedAt: new Date(), reviewedById: actor.id },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'APPLICATION_UPDATE_NOTE',
      entity: 'Application',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { previousStatus: app.status },
    });

    return updated;
  }

  /**
   * cancel()
   * Pelamar membatalkan lamarannya. Hanya bila status masih APPLIED.
   * Admin juga diizinkan membantu membatalkan.
   */
  async cancel(id: string, actor: AuthUser, ctx: RequestContext): Promise<Application> {
    const app = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: { jobSeeker: { select: { userId: true } }, job: { select: { title: true } } },
    });
    if (!app) throw new NotFoundException('Lamaran tidak ditemukan');

    const isOwner = app.jobSeeker.userId === actor.id;
    const isAdmin = ADMIN_ROLES.has(actor.role);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Hanya pemilik lamaran (atau admin) yang dapat membatalkan');
    }
    if (app.status !== ApplicationStatus.APPLIED) {
      throw new BadRequestException('Lamaran hanya dapat dibatalkan saat status masih APPLIED');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id },
        data: { status: ApplicationStatus.CANCELLED },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: ApplicationStatus.APPLIED,
          toStatus: ApplicationStatus.CANCELLED,
          note: isOwner ? 'Dibatalkan oleh pelamar' : 'Dibatalkan oleh admin',
          actorId: actor.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: app.jobSeeker.userId,
          type: NotificationType.APPLICATION_STATUS,
          title: 'Lamaran dibatalkan',
          message: `Lamaran untuk "${app.job.title}" telah dibatalkan.`,
          data: { applicationId: id, status: ApplicationStatus.CANCELLED },
        },
      });

      return u;
    });

    await this.audit.write({
      userId: actor.id,
      action: 'APPLICATION_CANCEL',
      entity: 'Application',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete oleh admin.
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const app = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
    });
    if (!app) throw new NotFoundException('Lamaran tidak ditemukan');

    await this.prisma.application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'APPLICATION_DELETE',
      entity: 'Application',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * buildWhere()
   * Bangun klausa where untuk list + filter umum.
   */
  private buildWhere(
    query: FilterApplicationDto,
    search: string | undefined,
  ): Prisma.ApplicationWhereInput {
    const where: Prisma.ApplicationWhereInput = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.jobId && { jobId: query.jobId }),
      ...(query.jobSeekerId && { jobSeekerId: query.jobSeekerId }),
      ...(query.companyId && { job: { companyId: query.companyId } }),
      ...(query.appliedFrom || query.appliedTo
        ? {
            appliedAt: {
              ...(query.appliedFrom && { gte: new Date(query.appliedFrom) }),
              ...(query.appliedTo && { lte: new Date(query.appliedTo) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { job: { title: { contains: search, mode: 'insensitive' } } },
          { jobSeeker: { fullName: { contains: search, mode: 'insensitive' } } },
          { jobSeeker: { user: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };
    return where;
  }

  /**
   * resolveJobSeekerIdForActor()
   * Ambil jobSeekerId milik JOB_SEEKER yang sedang login.
   */
  private async resolveJobSeekerIdForActor(actor: AuthUser): Promise<string> {
    if (actor.role !== 'JOB_SEEKER') {
      throw new ForbiddenException('Hanya pencari kerja yang dapat membuat lamaran sendiri');
    }
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException('Anda belum membuat profil pencari kerja');
    }
    return profile.id;
  }

  /**
   * getForReview()
   * Ambil lamaran + cek apakah actor boleh me-review
   * (admin atau COMPANY/HRD pemilik lowongan).
   */
  private async getForReview(id: string, actor: AuthUser): Promise<Application> {
    const app = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: { job: { select: { companyId: true } } },
    });
    if (!app) throw new NotFoundException('Lamaran tidak ditemukan');

    if (ADMIN_ROLES.has(actor.role)) return app;
    await this.assertCanManageCompanyJob(app.job.companyId, actor);
    return app;
  }

  /**
   * assertCanManageCompanyJob()
   * Pastikan actor adalah COMPANY (owner) atau HRD dari perusahaan
   * pemilik lowongan.
   */
  private async assertCanManageCompanyJob(companyId: string, actor: AuthUser): Promise<void> {
    if (ADMIN_ROLES.has(actor.role)) return;

    if (actor.role === 'COMPANY') {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, userId: actor.id, deletedAt: null },
        select: { id: true },
      });
      if (company) return;
    }

    if (actor.role === 'HRD') {
      const member = await this.prisma.companyHrd.findUnique({
        where: { companyId_userId: { companyId, userId: actor.id } },
      });
      if (member) return;
    }

    throw new ForbiddenException('Anda tidak berhak mengelola lamaran pada lowongan ini');
  }

  /**
   * assertCanViewApplication()
   * Aturan view lamaran:
   *  - admin: bebas
   *  - JOB_SEEKER pemilik
   *  - COMPANY/HRD pemilik lowongan
   */
  private async assertCanViewApplication(
    app: Application & { jobSeekerId: string; jobId: string },
    actor: AuthUser,
  ): Promise<void> {
    if (ADMIN_ROLES.has(actor.role)) return;

    if (actor.role === 'JOB_SEEKER') {
      const profile = await this.prisma.jobSeeker.findFirst({
        where: { id: app.jobSeekerId, userId: actor.id, deletedAt: null },
        select: { id: true },
      });
      if (profile) return;
      throw new ForbiddenException('Anda hanya boleh melihat lamaran Anda sendiri');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: app.jobId },
      select: { companyId: true },
    });
    if (!job) throw new ForbiddenException('Akses ditolak');
    await this.assertCanManageCompanyJob(job.companyId, actor);
  }

  /**
   * statusNotificationTitle()
   */
  private statusNotificationTitle(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatus.REVIEWED:
        return 'Lamaran sedang ditinjau';
      case ApplicationStatus.SHORTLISTED:
        return 'Anda masuk shortlist';
      case ApplicationStatus.INTERVIEW:
        return 'Anda diundang interview';
      case ApplicationStatus.ACCEPTED:
        return 'Selamat! Lamaran diterima';
      case ApplicationStatus.REJECTED:
        return 'Lamaran tidak dilanjutkan';
      case ApplicationStatus.CANCELLED:
        return 'Lamaran dibatalkan';
      default:
        return 'Status lamaran diperbarui';
    }
  }
}
