/**
 * File: backend/src/common/services/audit-logs.service.ts
 * Fungsi:
 *  - Service global untuk menulis audit log dari module manapun.
 *  - Best-effort: tidak melempar error agar tidak menggagalkan
 *    flow utama bila DB sedang bermasalah.
 *  - Dipakai oleh UsersService, RolesService, PermissionsService, dll.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface AuditWriteParams {
  userId?: string | null;
  action: string; // contoh: "USER_CREATE", "ROLE_DELETE"
  entity?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * write()
   * Menyimpan satu baris audit log. Error ditangkap & dilog
   * tanpa rethrow agar tidak mengganggu request utama.
   */
  async write(params: AuditWriteParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
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
}
