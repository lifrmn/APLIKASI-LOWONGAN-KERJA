/**
 * File: backend/src/common/services/audit-logs.service.ts
 * Fungsi:
 *  - Service tunggal untuk seluruh operasi audit log:
 *      WRITE:  write() / create()   — dipanggil module lain
 *      READ:   list(), findById()
 *      EXPORT: exportExcel()
 *      DELETE: deleteOne(), clearOld()
 *  - Dipasang global via DatabaseModule sehingga semua module dapat
 *    meng-inject langsung tanpa import ulang.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';

import { AuthUser } from '../decorators/current-user.decorator';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import {
  buildExcelBuffer,
  ExcelColumn,
} from '../../modules/reports/utils/export-excel.util';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER']);
const PURGE_ROLES = new Set(['SUPER_ADMIN']);

/**
 * AuditWriteParams
 * Parameter untuk menulis 1 audit log (dipakai module lain).
 */
export interface AuditWriteParams {
  userId?: string | null;
  action: string; // contoh: "USER_CREATE", "JOB_PUBLISH"
  module?: string | null; // contoh: "USERS", "JOBS"
  description?: string | null; // ringkasan singkat human-readable
  entity?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * AuditFilter
 * Filter list audit logs.
 */
export interface AuditFilter {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  action?: string;
  module?: string;
  entity?: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  //                              WRITE
  // ============================================================

  /**
   * write()
   * Tulis 1 baris audit log. Best-effort — tidak melempar error
   * agar tidak menggagalkan request utama.
   */
  async write(params: AuditWriteParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
          module: params.module ?? null,
          description: params.description ?? null,
          entity: params.entity ?? null,
          entityId: params.entityId ?? null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`Gagal menulis audit log [${params.action}]: ${(e as Error).message}`);
    }
  }

  /**
   * create()
   * Alias dari write() agar API konsisten dengan service NestJS
   * lainnya (memudahkan integrasi & pengujian).
   */
  create(params: AuditWriteParams): Promise<void> {
    return this.write(params);
  }

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Daftar audit log (paginated + filter).
   */
  async list(filter: AuditFilter): Promise<PaginatedResult<AuditLog>> {
    const params = getPaginationParams({
      page: filter.page,
      limit: filter.limit,
      search: filter.search,
    });

    const where = this.buildWhere(filter);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   */
  async findById(id: string): Promise<AuditLog> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (!log) throw new NotFoundException('Audit log tidak ditemukan');
    return log;
  }

  // ============================================================
  //                            EXPORT
  // ============================================================

  /**
   * exportExcel()
   * Bangun Excel buffer dari hasil filter (cap aman 10k baris).
   */
  async exportExcel(filter: AuditFilter): Promise<AuditExportResult> {
    const where = this.buildWhere(filter);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    const mapped = rows.map((r) => ({
      createdAt: r.createdAt,
      user: r.user?.fullName ?? '-',
      email: r.user?.email ?? '-',
      action: r.action,
      module: r.module ?? '-',
      description: r.description ?? '-',
      entity: r.entity ?? '-',
      entityId: r.entityId ?? '-',
      ipAddress: r.ipAddress ?? '-',
      metadata: r.metadata ?? '',
    }));

    const columns: ExcelColumn[] = [
      { header: 'Waktu', key: 'createdAt', width: 20 },
      { header: 'User', key: 'user', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Module', key: 'module', width: 16 },
      { header: 'Deskripsi', key: 'description', width: 40 },
      { header: 'Entity', key: 'entity', width: 16 },
      { header: 'Entity ID', key: 'entityId', width: 28 },
      { header: 'IP', key: 'ipAddress', width: 16 },
      { header: 'Metadata', key: 'metadata', width: 50 },
    ];

    const buffer = await buildExcelBuffer({
      title: 'Audit Log',
      subtitle: this.subtitleFromFilter(filter),
      columns,
      rows: mapped,
      summary: { 'Total Baris': mapped.length },
      sheetName: 'Audit Log',
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    return {
      buffer,
      filename: `audit-logs-${stamp}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ============================================================
  //                            DELETE
  // ============================================================

  /**
   * deleteOne()
   * Hanya SUPER_ADMIN. Pemanggilan juga ditulis ulang
   * sebagai audit log baru (action AUDIT_DELETE).
   */
  async deleteOne(
    id: string,
    actor: AuthUser,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    this.assertPurger(actor);
    const exists = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Audit log tidak ditemukan');

    await this.prisma.auditLog.delete({ where: { id } });

    await this.write({
      userId: actor.id,
      action: 'AUDIT_DELETE',
      module: 'AUDIT_LOGS',
      description: `Audit log ${id} dihapus`,
      entity: 'AuditLog',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * clearOld()
   * Bersihkan audit log lebih lama dari N hari (default 365).
   * Minimum 30 hari untuk safety. Hanya SUPER_ADMIN.
   */
  async clearOld(
    days: number,
    actor: AuthUser,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<{ deleted: number; before: Date }> {
    this.assertPurger(actor);
    const safeDays = Math.max(30, Math.floor(days));
    const before = new Date();
    before.setDate(before.getDate() - safeDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: before } },
    });

    await this.write({
      userId: actor.id,
      action: 'AUDIT_CLEAR_OLD',
      module: 'AUDIT_LOGS',
      description: `Bersihkan ${result.count} audit log < ${before.toISOString()}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { days: safeDays, deleted: result.count },
    });

    return { deleted: result.count, before };
  }

  // ============================================================
  //                          AUTHORIZATION
  // ============================================================

  static canRead(actor: AuthUser): boolean {
    return ADMIN_ROLES.has(actor.role);
  }

  private assertPurger(actor: AuthUser): void {
    if (!PURGE_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya SUPER_ADMIN yang dapat menghapus audit log');
    }
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  private buildWhere(filter: AuditFilter): Prisma.AuditLogWhereInput {
    const range: Prisma.AuditLogWhereInput = {};
    if (filter.startDate || filter.endDate) {
      const cond: { gte?: Date; lte?: Date } = {};
      if (filter.startDate) cond.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const e = new Date(filter.endDate);
        e.setHours(23, 59, 59, 999);
        cond.lte = e;
      }
      range.createdAt = cond;
    }

    return {
      ...range,
      ...(filter.userId && { userId: filter.userId }),
      ...(filter.action && { action: { contains: filter.action, mode: 'insensitive' } }),
      ...(filter.module && { module: { contains: filter.module, mode: 'insensitive' } }),
      ...(filter.entity && { entity: { contains: filter.entity, mode: 'insensitive' } }),
      ...(filter.ipAddress && { ipAddress: filter.ipAddress }),
      ...(filter.search && {
        OR: [
          { action: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
          { entity: { contains: filter.search, mode: 'insensitive' } },
          { user: { email: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };
  }

  private subtitleFromFilter(filter: AuditFilter): string | undefined {
    const parts: string[] = [];
    if (filter.startDate) parts.push(`Dari ${filter.startDate}`);
    if (filter.endDate) parts.push(`Sampai ${filter.endDate}`);
    if (filter.module) parts.push(`Module: ${filter.module}`);
    if (filter.action) parts.push(`Action: ${filter.action}`);
    return parts.length ? parts.join(' • ') : undefined;
  }
}
