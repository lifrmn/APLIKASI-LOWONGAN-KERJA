/**
 * File: backend/src/modules/permissions/permissions.service.ts
 * Fungsi:
 *  - Logika bisnis CRUD permission.
 *  - Soft delete (set deletedAt) agar history relasi RolePermission
 *    tetap konsisten secara historis.
 *  - Audit log untuk create / update / delete.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { RequestContext } from '../auth/auth.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  /**
   * list()
   * Daftar permission dengan pagination + search (code/description).
   */
  async list(query: PaginationQueryDto): Promise<PaginatedResult<Permission>> {
    const params = getPaginationParams(query);

    const where: Prisma.PermissionWhereInput = {
      deletedAt: null,
      ...(params.search && {
        OR: [
          { code: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.PermissionOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { code: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.permission.findMany({ where, orderBy, skip: params.skip, take: params.take }),
      this.prisma.permission.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   * Ambil satu permission, throw 404 bila tidak ada / soft-deleted.
   */
  async findById(id: string): Promise<Permission> {
    const permission = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
    });
    if (!permission) throw new NotFoundException('Permission tidak ditemukan');
    return permission;
  }

  /**
   * create()
   * Membuat permission baru. Kode harus unik.
   */
  async create(
    dto: CreatePermissionDto,
    actorId: string,
    ctx: RequestContext,
  ): Promise<Permission> {
    const existing = await this.prisma.permission.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Kode permission "${dto.code}" sudah ada`);

    const created = await this.prisma.permission.create({ data: dto });

    await this.audit.write({
      userId: actorId,
      action: 'PERMISSION_CREATE',
      entity: 'Permission',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { code: created.code },
    });

    return created;
  }

  /**
   * update()
   * Update permission. Jika kode berubah, pastikan tetap unik.
   */
  async update(
    id: string,
    dto: UpdatePermissionDto,
    actorId: string,
    ctx: RequestContext,
  ): Promise<Permission> {
    await this.findById(id);

    if (dto.code) {
      const dup = await this.prisma.permission.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Kode permission "${dto.code}" sudah digunakan`);
    }

    const updated = await this.prisma.permission.update({ where: { id }, data: dto });

    await this.audit.write({
      userId: actorId,
      action: 'PERMISSION_UPDATE',
      entity: 'Permission',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete permission + putuskan relasi RolePermission.
   */
  async remove(id: string, actorId: string, ctx: RequestContext): Promise<void> {
    await this.findById(id);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { permissionId: id } }),
      this.prisma.permission.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.audit.write({
      userId: actorId,
      action: 'PERMISSION_DELETE',
      entity: 'Permission',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }
}
