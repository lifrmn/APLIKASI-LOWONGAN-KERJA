/**
 * File: backend/src/modules/roles/roles.service.ts
 * Fungsi:
 *  - Logika bisnis CRUD role + assign/remove permission ke role.
 *  - Soft delete (set deletedAt). Role yang masih dipakai user
 *    tidak boleh dihapus (proteksi referential).
 *  - Audit log untuk semua aksi mutatif.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { RequestContext } from '../auth/auth.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

/**
 * Role yang tidak boleh dihapus/diubah nama-nya (system role).
 */
const PROTECTED_ROLE_NAMES = new Set(['SUPER_ADMIN']);

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  /**
   * list()
   * Daftar role dengan pagination + search nama/deskripsi,
   * sekaligus jumlah user & permission terkait.
   */
  async list(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const params = getPaginationParams(query);

    const where: Prisma.RoleWhereInput = {
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.RoleOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { name: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          _count: { select: { users: true, rolePermissions: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   * Ambil role beserta daftar permissions-nya.
   */
  async findById(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    return role;
  }

  /**
   * findByName()
   * Helper internal: cari role berdasarkan nama (dipakai modul lain).
   */
  findByName(name: string) {
    return this.prisma.role.findFirst({ where: { name, deletedAt: null } });
  }

  /**
   * create()
   * Buat role baru. Nama harus unik (case-sensitive).
   */
  async create(dto: CreateRoleDto, actorId: string, ctx: RequestContext): Promise<Role> {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" sudah ada`);

    const created = await this.prisma.role.create({ data: dto });

    await this.audit.write({
      userId: actorId,
      action: 'ROLE_CREATE',
      entity: 'Role',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { name: created.name },
    });

    return created;
  }

  /**
   * update()
   * Update role. Tidak boleh mengubah nama role yang dilindungi.
   */
  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    ctx: RequestContext,
  ): Promise<Role> {
    const role = await this.findById(id);

    if (dto.name && dto.name !== role.name) {
      if (PROTECTED_ROLE_NAMES.has(role.name)) {
        throw new BadRequestException(`Role "${role.name}" tidak boleh diubah namanya`);
      }
      const dup = await this.prisma.role.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Nama role "${dto.name}" sudah dipakai`);
    }

    const updated = await this.prisma.role.update({ where: { id }, data: dto });

    await this.audit.write({
      userId: actorId,
      action: 'ROLE_UPDATE',
      entity: 'Role',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete role. Ditolak bila:
   *  - role termasuk system role
   *  - masih ada user yang memakai role tersebut
   */
  async remove(id: string, actorId: string, ctx: RequestContext): Promise<void> {
    const role = await this.findById(id);

    if (PROTECTED_ROLE_NAMES.has(role.name)) {
      throw new BadRequestException(`Role "${role.name}" tidak boleh dihapus`);
    }

    const userCount = await this.prisma.user.count({
      where: { roleId: id, deletedAt: null },
    });
    if (userCount > 0) {
      throw new BadRequestException(
        `Role masih dipakai oleh ${userCount} user. Pindahkan dulu role user tersebut.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);

    await this.audit.write({
      userId: actorId,
      action: 'ROLE_DELETE',
      entity: 'Role',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * assignPermissions()
   * Tambah satu/banyak permission ke role.
   * Permission yang sudah ter-assign akan diabaikan (skipDuplicates).
   */
  async assignPermissions(
    roleId: string,
    permissionIds: string[],
    actorId: string,
    ctx: RequestContext,
  ) {
    await this.findById(roleId);

    const valid = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds }, deletedAt: null },
      select: { id: true },
    });
    if (valid.length !== permissionIds.length) {
      throw new BadRequestException('Ada permission yang tidak valid atau sudah dihapus');
    }

    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });

    await this.audit.write({
      userId: actorId,
      action: 'ROLE_ASSIGN_PERMISSION',
      entity: 'Role',
      entityId: roleId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { permissionIds },
    });

    return this.findById(roleId);
  }

  /**
   * removePermission()
   * Hapus satu permission dari role.
   */
  async removePermission(
    roleId: string,
    permissionId: string,
    actorId: string,
    ctx: RequestContext,
  ) {
    await this.findById(roleId);

    const link = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!link) throw new NotFoundException('Permission tidak terhubung ke role ini');

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    await this.audit.write({
      userId: actorId,
      action: 'ROLE_REMOVE_PERMISSION',
      entity: 'Role',
      entityId: roleId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { permissionId },
    });

    return this.findById(roleId);
  }
}
