/**
 * File: backend/src/modules/files/files.service.ts
 * Fungsi:
 *  - Logika bisnis FilesModule: store metadata, list (paginated +
 *    filter), detail, download (stream), update (isPublic), soft delete.
 *  - Otorisasi: SUPER_ADMIN/ADMIN_DINAS = bebas. User biasa: hanya
 *    file miliknya, atau file public.
 *  - Audit log untuk upload & delete.
 */

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Prisma, UploadedFile as UploadedFileRecord } from '@prisma/client';
import { createReadStream, existsSync } from 'fs';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import { FilterFileDto } from './dto/filter-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FileCategory } from './enums/file-category.enum';
import { extractExtension } from './utils/file-name.util';
import { resolveAbsolutePath } from './utils/file-path.util';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

export interface StoreFileOptions {
  category: FileCategory;
  ownerId: string;
  isPublic?: boolean;
}

export interface DownloadPayload {
  stream: StreamableFile;
  filename: string;
  mimeType: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                           STORE / READ
  // ============================================================

  /**
   * store()
   * Simpan metadata file (yang sudah ditulis ke disk oleh Multer)
   * ke tabel uploaded_files. Dipanggil oleh setiap endpoint upload.
   */
  async store(
    file: Express.Multer.File,
    options: StoreFileOptions,
    ctx: RequestContext,
  ): Promise<UploadedFileRecord> {
    const created = await this.prisma.uploadedFile.create({
      data: {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size,
        extension: extractExtension(file.originalname),
        category: options.category,
        isPublic: options.isPublic ?? this.defaultIsPublic(options.category),
        ownerId: options.ownerId,
      },
    });

    await this.audit.write({
      userId: options.ownerId,
      action: 'FILE_UPLOAD',
      entity: 'UploadedFile',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { category: created.category, size: created.size, mimeType: created.mimeType },
    });

    return created;
  }

  /**
   * list()
   * Daftar file dengan pagination & filter.
   * Non-admin otomatis difilter ke file milik mereka sendiri saja.
   */
  async list(
    query: FilterFileDto,
    actor: AuthUser,
  ): Promise<PaginatedResult<UploadedFileRecord>> {
    const params = getPaginationParams(query);
    const isAdmin = ADMIN_ROLES.has(actor.role);

    const where: Prisma.UploadedFileWhereInput = {
      deletedAt: null,
      ...(query.category && { category: query.category }),
      ...(query.mimeType && { mimeType: query.mimeType }),
      ...(typeof query.isPublic === 'boolean' && { isPublic: query.isPublic }),
      // Non-admin: paksa hanya file miliknya
      ...(isAdmin
        ? query.ownerId
          ? { ownerId: query.ownerId }
          : {}
        : { ownerId: actor.id }),
      ...(params.search && {
        OR: [
          { originalName: { contains: params.search, mode: 'insensitive' } },
          { filename: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.UploadedFileOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.uploadedFile.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.uploadedFile.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   * Detail metadata file. Akses: admin, owner, atau public.
   */
  async findById(id: string, actor?: AuthUser): Promise<UploadedFileRecord> {
    const file = await this.getRecord(id);
    this.assertCanRead(file, actor);
    return file;
  }

  /**
   * findPublic()
   * Khusus untuk endpoint @Public(): tolak bila file tidak public.
   */
  async findPublic(id: string): Promise<UploadedFileRecord> {
    const file = await this.getRecord(id);
    if (!file.isPublic) {
      throw new ForbiddenException('File ini tidak dapat diakses publik');
    }
    return file;
  }

  /**
   * download()
   * Buat StreamableFile + metadata untuk response. Caller controller
   * yang men-set header Content-Type & Content-Disposition.
   */
  download(file: UploadedFileRecord, disposition: 'attachment' | 'inline' = 'attachment'): DownloadPayload {
    const absPath = resolveAbsolutePath(file.path);
    if (!existsSync(absPath)) {
      throw new NotFoundException('File fisik tidak ditemukan di server');
    }
    // disposition info hanya untuk caller; tidak dipakai di sini, jaga
    // signature explicit agar tidak misleading.
    void disposition;

    const stream = new StreamableFile(createReadStream(absPath), {
      type: file.mimeType,
      disposition: `${disposition}; filename="${file.originalName.replace(/"/g, '')}"`,
    });

    return { stream, filename: file.originalName, mimeType: file.mimeType };
  }

  /**
   * update()
   * Update field metadata yang diizinkan (saat ini: isPublic).
   * Hanya admin atau owner.
   */
  async update(
    id: string,
    dto: UpdateFileDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<UploadedFileRecord> {
    const file = await this.getRecord(id);
    this.assertCanManage(file, actor);

    const updated = await this.prisma.uploadedFile.update({
      where: { id },
      data: {
        ...(typeof dto.isPublic === 'boolean' && { isPublic: dto.isPublic }),
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'FILE_UPDATE',
      entity: 'UploadedFile',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete file (set deletedAt). File fisik di disk tetap
   * dipertahankan untuk recovery; cleanup bisa ditambahkan via
   * scheduler (tahap berikutnya).
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const file = await this.getRecord(id);
    this.assertCanManage(file, actor);

    await this.prisma.uploadedFile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'FILE_DELETE',
      entity: 'UploadedFile',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { filename: file.filename, category: file.category },
    });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  private async getRecord(id: string): Promise<UploadedFileRecord> {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException('File tidak ditemukan');
    return file;
  }

  /**
   * assertCanRead()
   * Aturan baca:
   *  - admin: bebas
   *  - owner: bebas
   *  - public: bebas
   *  - lainnya: tolak
   */
  private assertCanRead(file: UploadedFileRecord, actor?: AuthUser): void {
    if (file.isPublic) return;
    if (!actor) throw new ForbiddenException('Anda harus login untuk mengakses file ini');
    if (ADMIN_ROLES.has(actor.role)) return;
    if (file.ownerId && file.ownerId === actor.id) return;
    throw new ForbiddenException('Anda tidak berhak mengakses file ini');
  }

  /**
   * assertCanManage()
   * Aturan ubah/hapus: admin atau owner.
   */
  private assertCanManage(file: UploadedFileRecord, actor: AuthUser): void {
    if (ADMIN_ROLES.has(actor.role)) return;
    if (file.ownerId && file.ownerId === actor.id) return;
    throw new ForbiddenException('Anda tidak berhak mengubah/menghapus file ini');
  }

  /**
   * defaultIsPublic()
   * Default isPublic per kategori. Hanya COMPANY_LOGO yang
   * public secara default agar bisa ditampilkan di mobile/web
   * tanpa otentikasi.
   */
  private defaultIsPublic(category: FileCategory): boolean {
    return category === FileCategory.COMPANY_LOGO;
  }
}
