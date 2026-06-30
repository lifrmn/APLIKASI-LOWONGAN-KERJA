/**
 * File: backend/src/modules/job-seekers/job-seekers.service.ts
 * Fungsi:
 *  - Logika bisnis untuk profil pencari kerja:
 *      CRUD profil, sub-resource education/experiences/skills,
 *      upload CV/sertifikat/portofolio, update workStatus,
 *      profile saya (me).
 *  - Selalu menulis audit log untuk aksi mutatif.
 *  - Memberlakukan ownership: JOB_SEEKER hanya boleh menyentuh
 *    profilnya sendiri; role admin boleh akses semua.
 *
 * NOTE: Provinsi/Kabupaten/Kecamatan/Desa disimpan sebagai String
 * (belum FK) hingga RegionsModule dibuat.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Certificate,
  EducationHistory,
  FileCategory,
  JobSeeker,
  Portfolio,
  Prisma,
  WorkExperience,
  WorkStatus,
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
import { AddSkillDto } from './dto/add-skill.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { CreateJobSeekerDto } from './dto/create-job-seeker.dto';
import { ListJobSeekersQueryDto } from './dto/list-job-seekers.query.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { UpdateJobSeekerStatusDto } from './dto/update-job-seeker-status.dto';
import { UpdateJobSeekerDto } from './dto/update-job-seeker.dto';

/**
 * Daftar role yang dianggap "admin" dalam konteks modul ini.
 */
const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN_DINAS',
  'OPERATOR_KECAMATAN',
  'OPERATOR_DESA',
]);

/**
 * Detail relasi yang dimuat saat ambil JobSeeker.
 */
const fullInclude = {
  user: { select: { id: true, email: true, fullName: true, status: true } },
  cvFile: true,
  profilePhotoFile: true,
  educations: { orderBy: { startYear: 'desc' as const } },
  experiences: { orderBy: { startDate: 'desc' as const } },
  skills: { include: { skill: true } },
  certificates: { where: { deletedAt: null }, include: { file: true } },
  portfolios: { where: { deletedAt: null }, include: { file: true } },
} satisfies Prisma.JobSeekerInclude;

@Injectable()
export class JobSeekersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Daftar pencari kerja dengan pagination + filter & search.
   */
  async list(query: ListJobSeekersQueryDto): Promise<PaginatedResult<JobSeeker>> {
    const params = getPaginationParams(query);

    const where: Prisma.JobSeekerWhereInput = {
      deletedAt: null,
      ...(query.workStatus && { workStatus: query.workStatus }),
      ...(query.provinceId && { provinceId: query.provinceId }),
      ...(query.regencyId && { regencyId: query.regencyId }),
      ...(query.districtId && { districtId: query.districtId }),
      ...(query.villageId && { villageId: query.villageId }),
      ...(query.lastEducation && { lastEducation: query.lastEducation }),
      ...(query.skillId && {
        skills: { some: { skillId: query.skillId } },
      }),
      ...(params.search && {
        OR: [
          { fullName: { contains: params.search, mode: 'insensitive' } },
          { nik: { contains: params.search } },
          { major: { contains: params.search, mode: 'insensitive' } },
          { user: { email: { contains: params.search, mode: 'insensitive' } } },
          {
            skills: {
              some: { skill: { name: { contains: params.search, mode: 'insensitive' } } },
            },
          },
        ],
      }),
    };

    const orderBy: Prisma.JobSeekerOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { createdAt: params.order };

    const [data, total] = await Promise.all([
      this.prisma.jobSeeker.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          skills: { include: { skill: true } },
          cvFile: true,
        },
      }),
      this.prisma.jobSeeker.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findMe()
   * Profil milik user yang sedang login (JOB_SEEKER).
   */
  async findMe(userId: string) {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { userId, deletedAt: null },
      include: fullInclude,
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja belum dibuat');
    return profile;
  }

  /**
   * findById()
   * Ambil 1 profil. Otorisasi: owner atau admin.
   */
  async findById(id: string, actor: AuthUser) {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { id, deletedAt: null },
      include: fullInclude,
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja tidak ditemukan');
    this.assertOwnerOrAdmin(profile.userId, actor);
    return profile;
  }

  // ============================================================
  //                             WRITE
  // ============================================================

  /**
   * create()
   * Membuat profil pencari kerja.
   *  - JOB_SEEKER hanya boleh membuat profil untuk dirinya sendiri.
   *  - Admin wajib menyertakan userId.
   *  - Satu user hanya boleh punya 1 profil aktif.
   */
  async create(dto: CreateJobSeekerDto, actor: AuthUser, ctx: RequestContext): Promise<JobSeeker> {
    const targetUserId = ADMIN_ROLES.has(actor.role) ? dto.userId : actor.id;
    if (!targetUserId) {
      throw new BadRequestException('userId wajib diisi (oleh admin)');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const existing = await this.prisma.jobSeeker.findUnique({
      where: { userId: targetUserId },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('User ini sudah memiliki profil pencari kerja');
    }

    if (dto.nik) {
      const dup = await this.prisma.jobSeeker.findFirst({
        where: { nik: dto.nik, deletedAt: null },
      });
      if (dup) throw new ConflictException('NIK sudah digunakan profil lain');
    }

    const created = await this.prisma.jobSeeker.create({
      data: {
        userId: targetUserId,
        nik: dto.nik,
        fullName: dto.fullName,
        birthPlace: dto.birthPlace,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        phone: dto.phone,
        address: dto.address,
        provinceId: dto.provinceId,
        regencyId: dto.regencyId,
        districtId: dto.districtId,
        villageId: dto.villageId,
        lastEducation: dto.lastEducation,
        major: dto.major,
        graduationYear: dto.graduationYear,
        workStatus: dto.workStatus ?? WorkStatus.UNEMPLOYED,
        expectedSalary: dto.expectedSalary,
        about: dto.about,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_CREATE',
      entity: 'JobSeeker',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return created;
  }

  /**
   * update()
   * Update field profil pencari kerja.
   */
  async update(
    id: string,
    dto: UpdateJobSeekerDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<JobSeeker> {
    const profile = await this.getOwned(id, actor);

    if (dto.nik && dto.nik !== profile.nik) {
      const dup = await this.prisma.jobSeeker.findFirst({
        where: { nik: dto.nik, NOT: { id } },
      });
      if (dup) throw new ConflictException('NIK sudah digunakan profil lain');
    }

    const updated = await this.prisma.jobSeeker.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_UPDATE',
      entity: 'JobSeeker',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * updateStatus()
   * Ubah workStatus (oleh admin atau owner).
   */
  async updateStatus(
    id: string,
    dto: UpdateJobSeekerStatusDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<JobSeeker> {
    await this.getOwned(id, actor);

    const updated = await this.prisma.jobSeeker.update({
      where: { id },
      data: { workStatus: dto.workStatus },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_CHANGE_STATUS',
      entity: 'JobSeeker',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { workStatus: dto.workStatus },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete profil (hanya admin tertentu — dijaga di controller).
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { id, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja tidak ditemukan');

    await this.prisma.jobSeeker.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_DELETE',
      entity: 'JobSeeker',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                           EDUCATION
  // ============================================================

  async addEducation(
    jobSeekerId: string,
    dto: CreateEducationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<EducationHistory> {
    await this.getOwned(jobSeekerId, actor);

    const created = await this.prisma.educationHistory.create({
      data: { jobSeekerId, ...dto },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'EDUCATION_CREATE',
      entity: 'EducationHistory',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return created;
  }

  async updateEducation(
    jobSeekerId: string,
    educationId: string,
    dto: UpdateEducationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<EducationHistory> {
    await this.getOwned(jobSeekerId, actor);
    await this.assertChild('educationHistory', educationId, jobSeekerId);

    const updated = await this.prisma.educationHistory.update({
      where: { id: educationId },
      data: dto,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'EDUCATION_UPDATE',
      entity: 'EducationHistory',
      entityId: educationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  }

  async removeEducation(
    jobSeekerId: string,
    educationId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.getOwned(jobSeekerId, actor);
    await this.assertChild('educationHistory', educationId, jobSeekerId);

    await this.prisma.educationHistory.delete({ where: { id: educationId } });

    await this.audit.write({
      userId: actor.id,
      action: 'EDUCATION_DELETE',
      entity: 'EducationHistory',
      entityId: educationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                          EXPERIENCE
  // ============================================================

  async addExperience(
    jobSeekerId: string,
    dto: CreateExperienceDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<WorkExperience> {
    await this.getOwned(jobSeekerId, actor);

    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate tidak boleh lebih awal dari startDate');
    }

    const created = await this.prisma.workExperience.create({
      data: {
        jobSeekerId,
        company: dto.company,
        position: dto.position,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? !dto.endDate,
        description: dto.description,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'EXPERIENCE_CREATE',
      entity: 'WorkExperience',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return created;
  }

  async updateExperience(
    jobSeekerId: string,
    experienceId: string,
    dto: UpdateExperienceDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<WorkExperience> {
    await this.getOwned(jobSeekerId, actor);
    await this.assertChild('workExperience', experienceId, jobSeekerId);

    const updated = await this.prisma.workExperience.update({
      where: { id: experienceId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'EXPERIENCE_UPDATE',
      entity: 'WorkExperience',
      entityId: experienceId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  }

  async removeExperience(
    jobSeekerId: string,
    experienceId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.getOwned(jobSeekerId, actor);
    await this.assertChild('workExperience', experienceId, jobSeekerId);

    await this.prisma.workExperience.delete({ where: { id: experienceId } });

    await this.audit.write({
      userId: actor.id,
      action: 'EXPERIENCE_DELETE',
      entity: 'WorkExperience',
      entityId: experienceId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                              SKILLS
  // ============================================================

  /**
   * addSkill()
   * Tambah skill ke profil. Bila skillName diberikan, akan
   * find-or-create di tabel skills.
   */
  async addSkill(
    jobSeekerId: string,
    dto: AddSkillDto,
    actor: AuthUser,
    ctx: RequestContext,
  ) {
    await this.getOwned(jobSeekerId, actor);

    if (!dto.skillId && !dto.skillName) {
      throw new BadRequestException('skillId atau skillName wajib diisi');
    }

    let skillId = dto.skillId;
    if (!skillId && dto.skillName) {
      const name = dto.skillName.trim();
      const existing = await this.prisma.skill.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
      });
      const skill =
        existing ??
        (await this.prisma.skill.create({ data: { name } }));
      skillId = skill.id;
    }

    if (!skillId) throw new BadRequestException('Skill tidak valid');

    const dup = await this.prisma.jobSeekerSkill.findUnique({
      where: { jobSeekerId_skillId: { jobSeekerId, skillId } },
    });
    if (dup) throw new ConflictException('Skill sudah ada di profil ini');

    const link = await this.prisma.jobSeekerSkill.create({
      data: {
        jobSeekerId,
        skillId,
        level: dto.level,
        yearsOfExperience: dto.yearsOfExperience,
      },
      include: { skill: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_ADD_SKILL',
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { skillId, level: dto.level },
    });

    return link;
  }

  async removeSkill(
    jobSeekerId: string,
    skillId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.getOwned(jobSeekerId, actor);

    const link = await this.prisma.jobSeekerSkill.findUnique({
      where: { jobSeekerId_skillId: { jobSeekerId, skillId } },
    });
    if (!link) throw new NotFoundException('Skill tidak terhubung dengan profil ini');

    await this.prisma.jobSeekerSkill.delete({
      where: { jobSeekerId_skillId: { jobSeekerId, skillId } },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_REMOVE_SKILL',
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { skillId },
    });
  }

  // ============================================================
  //                              FILES
  // ============================================================

  /**
   * uploadCv()
   * Simpan metadata file CV + set cvFileId pada profil.
   * File fisik sudah ditulis ke disk oleh Multer di controller.
   */
  async uploadCv(
    jobSeekerId: string,
    file: Express.Multer.File,
    actor: AuthUser,
    ctx: RequestContext,
  ) {
    await this.getOwned(jobSeekerId, actor);

    const stored = await this.storeFile(file, FileCategory.CV, actor.id);

    const updated = await this.prisma.jobSeeker.update({
      where: { id: jobSeekerId },
      data: { cvFileId: stored.id },
      include: { cvFile: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_UPLOAD_CV',
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId: stored.id, filename: stored.filename },
    });

    return { jobSeeker: updated, file: stored };
  }

  /**
   * uploadCertificate()
   * Simpan file sertifikat + buat record Certificate.
   * Param `name` & `issuer` boleh dikirim via multipart field.
   */
  async uploadCertificate(
    jobSeekerId: string,
    file: Express.Multer.File,
    meta: { name?: string; issuer?: string; issueDate?: string; expiryDate?: string },
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Certificate> {
    await this.getOwned(jobSeekerId, actor);

    const stored = await this.storeFile(file, FileCategory.CERTIFICATE, actor.id);

    const created = await this.prisma.certificate.create({
      data: {
        jobSeekerId,
        name: meta.name ?? file.originalname,
        issuer: meta.issuer,
        issueDate: meta.issueDate ? new Date(meta.issueDate) : null,
        expiryDate: meta.expiryDate ? new Date(meta.expiryDate) : null,
        fileId: stored.id,
      },
      include: { file: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_UPLOAD_CERTIFICATE',
      entity: 'Certificate',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId: stored.id },
    });

    return created;
  }

  /**
   * uploadPortfolio()
   * Simpan file portofolio + buat record Portfolio.
   */
  async uploadPortfolio(
    jobSeekerId: string,
    file: Express.Multer.File | undefined,
    meta: { title?: string; description?: string; link?: string },
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Portfolio> {
    await this.getOwned(jobSeekerId, actor);

    if (!file && !meta.link) {
      throw new BadRequestException('Wajib mengirim file atau link portofolio');
    }

    let fileId: string | undefined;
    if (file) {
      const stored = await this.storeFile(file, FileCategory.PORTFOLIO, actor.id);
      fileId = stored.id;
    }

    const created = await this.prisma.portfolio.create({
      data: {
        jobSeekerId,
        title: meta.title ?? (file?.originalname ?? 'Portofolio'),
        description: meta.description,
        link: meta.link,
        fileId,
      },
      include: { file: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'JOB_SEEKER_UPLOAD_PORTFOLIO',
      entity: 'Portfolio',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId },
    });

    return created;
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * storeFile()
   * Buat record UploadedFile dari hasil Multer.
   */
  private storeFile(file: Express.Multer.File, category: FileCategory, ownerId: string) {
    return this.prisma.uploadedFile.create({
      data: {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size,
        category,
        ownerId,
      },
    });
  }

  /**
   * getOwned()
   * Ambil profil + cek ownership (owner atau admin).
   */
  private async getOwned(jobSeekerId: string, actor: AuthUser): Promise<JobSeeker> {
    const profile = await this.prisma.jobSeeker.findFirst({
      where: { id: jobSeekerId, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Profil pencari kerja tidak ditemukan');
    this.assertOwnerOrAdmin(profile.userId, actor);
    return profile;
  }

  /**
   * assertOwnerOrAdmin()
   * Lempar Forbidden bila bukan pemilik atau admin.
   */
  private assertOwnerOrAdmin(ownerUserId: string, actor: AuthUser): void {
    if (ADMIN_ROLES.has(actor.role)) return;
    if (ownerUserId === actor.id) return;
    throw new ForbiddenException('Anda tidak berhak mengakses profil ini');
  }

  /**
   * assertChild()
   * Pastikan child record (education/experience) memang milik
   * jobSeekerId yang sesuai.
   */
  private async assertChild(
    model: 'educationHistory' | 'workExperience',
    id: string,
    jobSeekerId: string,
  ): Promise<void> {
    const record =
      model === 'educationHistory'
        ? await this.prisma.educationHistory.findUnique({ where: { id } })
        : await this.prisma.workExperience.findUnique({ where: { id } });

    if (!record) throw new NotFoundException('Data tidak ditemukan');
    if (record.jobSeekerId !== jobSeekerId) {
      throw new ForbiddenException('Data ini bukan milik profil tersebut');
    }
  }
}
