/**
 * File: backend/src/modules/ocr-ektp/ocr-ektp.service.ts
 * Fungsi:
 *  - Logika bisnis OCR e-KTP:
 *      * submit()   — upload file e-KTP + panggil provider OCR
 *                     + simpan hasil ke ocr_ektp_results (status PENDING).
 *      * list()     — daftar hasil (admin) dengan pagination + filter.
 *      * findMine() — hasil terakhir milik user login.
 *      * findById() — detail 1 hasil; MASK NIK bila caller bukan owner
 *                     atau tidak punya permission sensitive.identity.read.
 *      * verify()   — set VERIFIED (admin).
 *      * reject()   — set REJECTED (admin, wajib alasan).
 *  - Setiap operasi menulis audit log; akses data sensitif dicatat
 *    dengan action=READ_SENSITIVE_DATA (module=OCR).
 */

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OcrEktpResult, OcrStatus, Prisma } from '@prisma/client';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import { FileCategory } from '../files/enums/file-category.enum';
import { FilesService } from '../files/files.service';
import { ListOcrQueryDto } from './dto/list-ocr.query.dto';
import { OcrResultDto, toOcrResultDto } from './dto/ocr-result.response';
import { OCR_PROVIDER, OcrProvider } from './providers/ocr-provider.interface';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);
const SENSITIVE_PERMISSION = 'sensitive.identity.read';
const VERIFY_PERMISSION = 'sensitive.identity.verify';

@Injectable()
export class OcrEktpService {
  constructor(
    @Inject(OCR_PROVIDER) private readonly provider: OcrProvider,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                             SUBMIT
  // ============================================================

  /**
   * submit()
   * Upload gambar e-KTP + jalankan OCR (mock) + simpan sebagai PENDING.
   * Bersifat OPSIONAL — tidak wajib untuk register.
   */
  async submit(
    actor: AuthUser,
    file: Express.Multer.File,
    ctx: RequestContext,
  ): Promise<OcrResultDto> {
    // 1) simpan file (isPublic dipaksa false untuk kategori E_KTP)
    const stored = await this.files.store(
      file,
      { category: FileCategory.E_KTP, ownerId: actor.id, isPublic: false },
      ctx,
    );

    // 2) jalankan provider OCR
    const extraction = await this.provider.extract(stored.path, stored.id);

    // 3) simpan hasil OCR
    const record = await this.prisma.ocrEktpResult.create({
      data: {
        userId: actor.id,
        fileId: stored.id,
        status: OcrStatus.PENDING,
        confidence: extraction.confidence,
        nik: extraction.nik,
        fullName: extraction.fullName,
        birthPlace: extraction.birthPlace,
        birthDate: extraction.birthDate,
        gender: extraction.gender ?? undefined,
        address: extraction.address,
        rtRw: extraction.rtRw,
        village: extraction.village,
        district: extraction.district,
        religion: extraction.religion,
        maritalStatus: extraction.maritalStatus,
        occupation: extraction.occupation,
        nationality: extraction.nationality,
        rawText: extraction.rawText,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'OCR_EKTP_SUBMIT',
      module: 'OCR',
      description: 'Submit hasil OCR e-KTP (PENDING)',
      entity: 'OcrEktpResult',
      entityId: record.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fileId: stored.id, confidence: extraction.confidence },
    });

    // owner boleh melihat NIK penuh miliknya sendiri
    return toOcrResultDto(record, true);
  }

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Admin: melihat semua hasil OCR (paginated + filter).
   * NIK selalu dimasking pada list, kecuali admin punya permission
   * sensitive.identity.read.
   */
  async list(
    actor: AuthUser,
    query: ListOcrQueryDto,
    ctx: RequestContext,
  ): Promise<PaginatedResult<OcrResultDto>> {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin yang boleh melihat daftar OCR');
    }
    const params = getPaginationParams(query);

    const where: Prisma.OcrEktpResultWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.userId && { userId: query.userId }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { nik: { equals: query.search } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.ocrEktpResult.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ocrEktpResult.count({ where }),
    ]);

    const canSeeFull = this.hasPermission(actor, SENSITIVE_PERMISSION);
    if (canSeeFull) {
      await this.logSensitiveRead(actor, ctx, `List OCR (n=${rows.length})`);
    }
    const data = rows.map((r) => toOcrResultDto(r, canSeeFull));
    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findMine()
   * Hasil OCR terakhir milik user login (boleh melihat NIK penuh miliknya).
   */
  async findMine(actor: AuthUser): Promise<OcrResultDto | null> {
    const row = await this.prisma.ocrEktpResult.findFirst({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return toOcrResultDto(row, true);
  }

  /**
   * findById()
   * Detail hasil OCR. NIK penuh hanya untuk owner / admin dengan
   * permission sensitive.identity.read.
   */
  async findById(
    actor: AuthUser,
    id: string,
    ctx: RequestContext,
  ): Promise<OcrResultDto> {
    const row = await this.prisma.ocrEktpResult.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Hasil OCR tidak ditemukan');

    const isOwner = row.userId === actor.id;
    const isAdmin = ADMIN_ROLES.has(actor.role);
    if (!isOwner && !isAdmin) throw new ForbiddenException('Tidak berhak mengakses data ini');

    const canSeeFull = isOwner || this.hasPermission(actor, SENSITIVE_PERMISSION);
    if (!isOwner && canSeeFull) {
      await this.logSensitiveRead(actor, ctx, `Read OCR ${id}`, id);
    }
    return toOcrResultDto(row, canSeeFull);
  }

  // ============================================================
  //                          VERIFY / REJECT
  // ============================================================

  async verify(
    actor: AuthUser,
    id: string,
    note: string | undefined,
    ctx: RequestContext,
  ): Promise<OcrResultDto> {
    this.assertAdminVerify(actor);
    const existing = await this.getPending(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ocrEktpResult.update({
        where: { id },
        data: {
          status: OcrStatus.VERIFIED,
          verifiedAt: new Date(),
          verifiedById: actor.id,
          rejectionReason: null,
        },
      });
      // set identityVerified pada JobSeeker (jika ada) & isi NIK bila kosong.
      // NIK di ocr_ektp_results bisa hasil mock/OCR yang bertabrakan dengan
      // NIK job_seeker lain (unique constraint) — bila collision, verifikasi
      // tetap sukses namun NIK tidak di-copy (dicatat lewat metadata audit).
      let nikApplied = false;
      try {
        await tx.jobSeeker.updateMany({
          where: { userId: row.userId, deletedAt: null },
          data: {
            identityVerified: true,
            ...(existing.nik ? { nik: existing.nik } : {}),
          },
        });
        nikApplied = !!existing.nik;
      } catch (e) {
        // P2002 (unique) atau P2025 (record tidak ada) — abaikan; retry tanpa NIK
        await tx.jobSeeker.updateMany({
          where: { userId: row.userId, deletedAt: null },
          data: { identityVerified: true },
        });
      }
      return { row, nikApplied };
    });

    await this.audit.write({
      userId: actor.id,
      action: 'OCR_EKTP_VERIFY',
      module: 'OCR',
      description: `Verifikasi OCR e-KTP disetujui${note ? ` — ${note}` : ''}`,
      entity: 'OcrEktpResult',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        targetUserId: existing.userId,
        note: note ?? null,
        nikApplied: updated.nikApplied,
      },
    });
    return toOcrResultDto(updated.row, true);
  }

  async reject(
    actor: AuthUser,
    id: string,
    reason: string,
    ctx: RequestContext,
  ): Promise<OcrResultDto> {
    this.assertAdminVerify(actor);
    const existing = await this.getPending(id);
    const updated = await this.prisma.ocrEktpResult.update({
      where: { id },
      data: {
        status: OcrStatus.REJECTED,
        rejectionReason: reason,
        verifiedAt: new Date(),
        verifiedById: actor.id,
      },
    });
    await this.audit.write({
      userId: actor.id,
      action: 'OCR_EKTP_REJECT',
      module: 'OCR',
      description: `Verifikasi OCR e-KTP ditolak: ${reason}`,
      entity: 'OcrEktpResult',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { targetUserId: existing.userId, reason },
    });
    return toOcrResultDto(updated, true);
  }

  // ============================================================
  //                            INTERNAL
  // ============================================================

  private assertAdminVerify(actor: AuthUser): void {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin yang boleh verifikasi e-KTP');
    }
    // Bila permission sensitive.identity.verify tidak diberikan, tetap
    // izinkan SUPER_ADMIN (ada di ADMIN_ROLES). Sisanya wajib.
    if (actor.role !== 'SUPER_ADMIN' && !this.hasPermission(actor, VERIFY_PERMISSION)) {
      throw new ForbiddenException(`Permission ${VERIFY_PERMISSION} tidak dimiliki`);
    }
  }

  private async getPending(id: string): Promise<OcrEktpResult> {
    const row = await this.prisma.ocrEktpResult.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Hasil OCR tidak ditemukan');
    if (row.status !== OcrStatus.PENDING) {
      throw new BadRequestException(
        `Hasil OCR sudah berstatus ${row.status}, tidak bisa diubah lagi`,
      );
    }
    return row;
  }

  private hasPermission(actor: AuthUser, permission: string): boolean {
    if (actor.role === 'SUPER_ADMIN') return true;
    return (actor.permissions ?? []).includes(permission);
  }

  private async logSensitiveRead(
    actor: AuthUser,
    ctx: RequestContext,
    description: string,
    entityId?: string,
  ): Promise<void> {
    await this.audit.write({
      userId: actor.id,
      action: 'READ_SENSITIVE_DATA',
      module: 'OCR',
      description,
      entity: 'OcrEktpResult',
      entityId: entityId ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { role: actor.role },
    });
  }
}
