/**
 * File: backend/src/modules/companies/companies.service.ts
 * Fungsi:
 *  - Logika bisnis CRUD perusahaan + verifikasi/reject + upload
 *    logo/legal document + manajemen HRD + status aktif/nonaktif.
 *  - Otorisasi:
 *      * SUPER_ADMIN/ADMIN_DINAS bisa akses semua.
 *      * COMPANY hanya bisa akses perusahaan miliknya sendiri.
 *      * HRD hanya bisa READ perusahaan tempatnya terdaftar.
 *  - Audit log otomatis pada semua aksi mutatif.
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
  CompanyHrd,
  FileCategory,
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
import { AddHrdDto } from './dto/add-hrd.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies.query.dto';
import { RejectCompanyDto } from './dto/reject-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { VerifyCompanyDto } from './dto/verify-company.dto';

/**
 * Role yang dianggap "admin pemerintah" — boleh akses & verifikasi semua.
 */
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);
const VERIFIER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

const fullInclude = {
  user: { select: { id: true, email: true, fullName: true, status: true } },
  logoFile: true,
  legalDocumentFile: true,
  hrds: {
    include: {
      user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
  verifications: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
    },
  },
} satisfies Prisma.CompanyInclude;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Daftar perusahaan dengan pagination + filter & search.
   * Search by companyName/businessField/email/address.
   */
  async list(query: ListCompaniesQueryDto): Promise<PaginatedResult<Company>> {
    const params = getPaginationParams(query);

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(query.verificationStatus && { verificationStatus: query.verificationStatus }),
      ...(query.businessField && {
        businessField: { contains: query.businessField, mode: 'insensitive' },
      }),
      ...(query.provinceId && { provinceId: query.provinceId }),
      ...(query.regencyId && { regencyId: query.regencyId }),
      ...(query.districtId && { districtId: query.districtId }),
      ...(query.villageId && { villageId: query.villageId }),
      ...(typeof query.isActive === 'boolean' && { isActive: query.isActive }),
      ...(params.search && {
        OR: [
          { companyName: { contains: params.search, mode: 'insensitive' } },
          { businessField: { contains: params.search, mode: 'insensitive' } },
          { address: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.CompanyOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { createdAt: params.order };

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          logoFile: true,
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findMe()
   * Perusahaan milik user login:
   *  - role COMPANY → perusahaan yang dia miliki
   *  - role HRD → perusahaan tempat dia terdaftar
   */
  async findMe(actor: AuthUser) {
    if (actor.role === 'COMPANY') {
      const company = await this.prisma.company.findFirst({
        where: { userId: actor.id, deletedAt: null },
        include: fullInclude,
      });
      if (!company) throw new NotFoundException('Anda belum membuat profil perusahaan');
      return company;
    }

    if (actor.role === 'HRD') {
      const membership = await this.prisma.companyHrd.findFirst({
        where: { userId: actor.id, company: { deletedAt: null } },
        include: { company: { include: fullInclude } },
      });
      if (!membership) throw new NotFoundException('Anda belum terdaftar sebagai HRD perusahaan');
      return membership.company;
    }

    throw new ForbiddenException('Endpoint ini hanya untuk akun COMPANY/HRD');
  }

  /**
   * findById()
   * Detail perusahaan dengan kontrol akses.
   */
  async findById(id: string, actor: AuthUser) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: fullInclude,
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');
    await this.assertCanView(company, actor);
    return company;
  }

  // ============================================================
  //                             WRITE
  // ============================================================

  /**
   * create()
   * Buat profil perusahaan.
   * - COMPANY hanya boleh membuat untuk dirinya sendiri (1 user = 1 company).
   * - Admin wajib mengirim userId pemilik.
   */
  async create(dto: CreateCompanyDto, actor: AuthUser, ctx: RequestContext): Promise<Company> {
    const ownerId = ADMIN_ROLES.has(actor.role) ? dto.userId : actor.id;
    if (!ownerId) {
      throw new BadRequestException('userId wajib diisi oleh admin');
    }

    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, deletedAt: null },
      include: { role: true },
    });
    if (!owner) throw new NotFoundException('User pemilik tidak ditemukan');
    if (owner.role.name !== 'COMPANY') {
      throw new BadRequestException('Owner perusahaan harus memiliki role COMPANY');
    }

    const existing = await this.prisma.company.findUnique({ where: { userId: ownerId } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('User ini sudah memiliki profil perusahaan');
    }

    const created = await this.prisma.company.create({
      data: {
        userId: ownerId,
        companyName: dto.companyName,
        businessField: dto.businessField,
        description: dto.description,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address: dto.address,
        provinceId: dto.provinceId,
        regencyId: dto.regencyId,
        districtId: dto.districtId,
        villageId: dto.villageId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_CREATE',
      entity: 'Company',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return created;
  }

  /**
   * update()
   * Update field perusahaan. Owner (COMPANY) atau admin.
   */
  async update(
    id: string,
    dto: UpdateCompanyDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Company> {
    await this.getManageable(id, actor);

    const updated = await this.prisma.company.update({
      where: { id },
      data: dto,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_UPDATE',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete perusahaan (hanya admin — dibatasi di controller).
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');

    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_DELETE',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * verify()
   * Tandai perusahaan VERIFIED + simpan history. Hanya admin.
   */
  async verify(
    id: string,
    dto: VerifyCompanyDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Company> {
    this.assertVerifier(actor);
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');

    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          verificationNote: dto.note,
          verifiedAt: new Date(),
          verifiedById: actor.id,
        },
      }),
      this.prisma.companyVerification.create({
        data: {
          companyId: id,
          status: VerificationStatus.VERIFIED,
          note: dto.note,
          actorId: actor.id,
        },
      }),
    ]);

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_VERIFY',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { note: dto.note },
    });

    return updated;
  }

  /**
   * reject()
   * Tolak verifikasi + alasan. Hanya admin.
   */
  async reject(
    id: string,
    dto: RejectCompanyDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Company> {
    this.assertVerifier(actor);
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');

    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          verificationNote: dto.note,
          verifiedAt: new Date(),
          verifiedById: actor.id,
        },
      }),
      this.prisma.companyVerification.create({
        data: {
          companyId: id,
          status: VerificationStatus.REJECTED,
          note: dto.note,
          actorId: actor.id,
        },
      }),
    ]);

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_REJECT',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { note: dto.note },
    });

    return updated;
  }

  /**
   * updateStatus()
   * Aktif/nonaktif perusahaan.
   * - Admin selalu boleh.
   * - Owner (COMPANY) boleh menonaktifkan/aktifkan akun perusahaannya.
   */
  async updateStatus(
    id: string,
    dto: UpdateCompanyStatusDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Company> {
    await this.getManageable(id, actor);

    const updated = await this.prisma.company.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_CHANGE_STATUS',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { isActive: dto.isActive },
    });

    return updated;
  }

  // ============================================================
  //                          FILE UPLOAD
  // ============================================================

  async uploadLogo(
    id: string,
    file: Express.Multer.File,
    actor: AuthUser,
    ctx: RequestContext,
  ) {
    await this.getManageable(id, actor);

    const stored = await this.storeFile(file, FileCategory.COMPANY_LOGO, actor.id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: { logoFileId: stored.id },
      include: { logoFile: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_UPLOAD_LOGO',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId: stored.id },
    });

    return { company: updated, file: stored };
  }

  async uploadLegalDocument(
    id: string,
    file: Express.Multer.File,
    actor: AuthUser,
    ctx: RequestContext,
  ) {
    await this.getManageable(id, actor);

    const stored = await this.storeFile(file, FileCategory.COMPANY_DOCUMENT, actor.id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        legalDocumentFileId: stored.id,
        // Upload ulang dokumen mengembalikan status ke PENDING untuk diverifikasi ulang
        verificationStatus: VerificationStatus.PENDING,
        verifiedAt: null,
        verifiedById: null,
      },
      include: { legalDocumentFile: true },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_UPLOAD_LEGAL_DOC',
      entity: 'Company',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId: stored.id },
    });

    return { company: updated, file: stored };
  }

  // ============================================================
  //                             HRD
  // ============================================================

  /**
   * listHrd()
   * Daftar HRD pada satu perusahaan.
   */
  async listHrd(companyId: string, actor: AuthUser) {
    await this.getCompanyForView(companyId, actor);
    return this.prisma.companyHrd.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * addHrd()
   * Tambah HRD ke perusahaan. User target harus memiliki role HRD.
   */
  async addHrd(
    companyId: string,
    dto: AddHrdDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<CompanyHrd> {
    await this.getManageable(companyId, actor);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new NotFoundException('User HRD tidak ditemukan');
    if (user.role.name !== 'HRD') {
      throw new BadRequestException('User yang ditambahkan harus memiliki role HRD');
    }

    const dup = await this.prisma.companyHrd.findUnique({
      where: { companyId_userId: { companyId, userId: dto.userId } },
    });
    if (dup) throw new ConflictException('User ini sudah terdaftar sebagai HRD perusahaan');

    const link = await this.prisma.companyHrd.create({
      data: { companyId, userId: dto.userId, position: dto.position },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_ADD_HRD',
      entity: 'Company',
      entityId: companyId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { hrdUserId: dto.userId, position: dto.position },
    });

    return link;
  }

  /**
   * removeHrd()
   * Hapus HRD dari perusahaan.
   */
  async removeHrd(
    companyId: string,
    userId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.getManageable(companyId, actor);

    const link = await this.prisma.companyHrd.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!link) throw new NotFoundException('HRD tidak terdaftar di perusahaan ini');

    await this.prisma.companyHrd.delete({
      where: { companyId_userId: { companyId, userId } },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'COMPANY_REMOVE_HRD',
      entity: 'Company',
      entityId: companyId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { hrdUserId: userId },
    });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * storeFile()
   * Simpan metadata file ke uploaded_files.
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
   * getCompanyForView()
   * Ambil perusahaan untuk dilihat (READ). HRD pun boleh.
   */
  private async getCompanyForView(id: string, actor: AuthUser): Promise<Company> {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');
    await this.assertCanView(company, actor);
    return company;
  }

  /**
   * getManageable()
   * Ambil perusahaan untuk diubah (WRITE). Hanya owner atau admin.
   * HRD TIDAK boleh memodifikasi perusahaan.
   */
  private async getManageable(id: string, actor: AuthUser): Promise<Company> {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Perusahaan tidak ditemukan');

    if (ADMIN_ROLES.has(actor.role)) return company;
    if (actor.role === 'COMPANY' && company.userId === actor.id) return company;

    throw new ForbiddenException('Anda tidak berhak memodifikasi perusahaan ini');
  }

  /**
   * assertCanView()
   * - Admin: bebas
   * - COMPANY: hanya milik sendiri
   * - HRD: hanya perusahaan tempat ia terdaftar
   * - Role lain: tolak
   */
  private async assertCanView(company: Company, actor: AuthUser): Promise<void> {
    if (ADMIN_ROLES.has(actor.role)) return;

    if (actor.role === 'COMPANY') {
      if (company.userId === actor.id) return;
      throw new ForbiddenException('Anda hanya boleh melihat perusahaan milik sendiri');
    }

    if (actor.role === 'HRD') {
      const member = await this.prisma.companyHrd.findUnique({
        where: { companyId_userId: { companyId: company.id, userId: actor.id } },
      });
      if (member) return;
      throw new ForbiddenException('Anda tidak terdaftar sebagai HRD di perusahaan ini');
    }

    // JOB_SEEKER & lainnya hanya boleh melihat perusahaan yg sudah VERIFIED & aktif.
    if (
      company.verificationStatus === VerificationStatus.VERIFIED &&
      company.isActive
    ) {
      return;
    }

    throw new ForbiddenException('Anda tidak berhak melihat perusahaan ini');
  }

  /**
   * assertVerifier()
   * Hanya SUPER_ADMIN/ADMIN_DINAS yang boleh verify/reject.
   */
  private assertVerifier(actor: AuthUser): void {
    if (!VERIFIER_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin yang dapat memverifikasi perusahaan');
    }
  }
}
