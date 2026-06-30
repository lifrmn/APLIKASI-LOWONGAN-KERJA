/**
 * File: backend/src/modules/users/users.service.ts
 * Fungsi:
 *  - Logika bisnis CRUD user + change role + change status +
 *    reset password (oleh admin) + ambil login history.
 *  - Field sensitif (password) selalu dihapus dari output.
 *  - Audit log untuk semua aksi mutatif.
 *  - Memberlakukan aturan: ADMIN_DINAS tidak boleh mengubah/hapus
 *    user dengan role SUPER_ADMIN; user juga tidak boleh menghapus
 *    dirinya sendiri.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

/**
 * Bentuk user yang aman dikirim ke client (tanpa password).
 */
const safeUserSelect = {
  id: true,
  email: true,
  username: true,
  phone: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  role: { select: { id: true, name: true, description: true } },
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * list()
   * Daftar user dengan pagination + search nama/email/username/role.
   */
  async list(query: PaginationQueryDto): Promise<PaginatedResult<SafeUser>> {
    const params = getPaginationParams(query);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.search && {
        OR: [
          { email: { contains: params.search, mode: 'insensitive' } },
          { fullName: { contains: params.search, mode: 'insensitive' } },
          { username: { contains: params.search, mode: 'insensitive' } },
          { role: { name: { contains: params.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.order }
      : { createdAt: params.order };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        select: safeUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findById()
   * Ambil 1 user (tanpa password).
   */
  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: safeUserSelect,
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  /**
   * loginHistory()
   * Daftar riwayat login user (paginated, terbaru dulu).
   */
  async loginHistory(userId: string, query: PaginationQueryDto) {
    await this.findById(userId); // pastikan user ada

    const params = getPaginationParams(query);
    const where: Prisma.LoginHistoryWhereInput = { userId };

    const [data, total] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.loginHistory.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  // ============================================================
  //                             WRITE
  // ============================================================

  /**
   * create()
   * Membuat user baru (oleh admin). Email/username/phone unik.
   */
  async create(dto: CreateUserDto, actor: AuthUser, ctx: RequestContext): Promise<SafeUser> {
    await this.assertUniqueIdentifiers(dto.email, dto.username, dto.phone);

    const role = await this.prisma.role.findFirst({
      where: { name: dto.roleName, deletedAt: null },
    });
    if (!role) throw new BadRequestException(`Role "${dto.roleName}" tidak tersedia`);

    // ADMIN_DINAS tidak boleh membuat user SUPER_ADMIN
    if (actor.role !== 'SUPER_ADMIN' && role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException('Hanya SUPER_ADMIN yang boleh membuat akun SUPER_ADMIN');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        phone: dto.phone,
        password: passwordHash,
        fullName: dto.fullName,
        status: dto.status ?? UserStatus.ACTIVE,
        roleId: role.id,
      },
      select: safeUserSelect,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: created.email, role: role.name },
    });

    return created;
  }

  /**
   * update()
   * Update field profil dasar user. Tidak mengubah password/role/status.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    const target = await this.assertManageable(id, actor);

    if (dto.email && dto.email !== target.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup && dup.id !== id) throw new ConflictException('Email sudah dipakai');
    }
    if (dto.username && dto.username !== target.username) {
      const dup = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (dup && dup.id !== id) throw new ConflictException('Username sudah dipakai');
    }
    if (dto.phone && dto.phone !== target.phone) {
      const dup = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (dup && dup.id !== id) throw new ConflictException('Nomor HP sudah dipakai');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: safeUserSelect,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { changes: dto },
    });

    return updated;
  }

  /**
   * remove()
   * Soft delete user + revoke seluruh refresh token agar session
   * langsung tidak berlaku. User tidak boleh menghapus dirinya sendiri.
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    if (id === actor.id) {
      throw new BadRequestException('Anda tidak dapat menghapus akun sendiri');
    }
    await this.assertManageable(id, actor);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), status: UserStatus.INACTIVE },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.write({
      userId: actor.id,
      action: 'USER_DELETE',
      entity: 'User',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * changeRole()
   * Ganti role user. ADMIN_DINAS tidak boleh promote ke SUPER_ADMIN
   * maupun mengubah role user SUPER_ADMIN.
   */
  async changeRole(
    id: string,
    dto: ChangeUserRoleDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    const target = await this.assertManageable(id, actor);

    const newRole = await this.prisma.role.findFirst({
      where: { name: dto.roleName, deletedAt: null },
    });
    if (!newRole) throw new BadRequestException(`Role "${dto.roleName}" tidak tersedia`);

    if (actor.role !== 'SUPER_ADMIN' && newRole.name === 'SUPER_ADMIN') {
      throw new ForbiddenException('Hanya SUPER_ADMIN yang boleh memberikan role SUPER_ADMIN');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: newRole.id },
      select: safeUserSelect,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'USER_CHANGE_ROLE',
      entity: 'User',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { from: target.role.name, to: newRole.name },
    });

    return updated;
  }

  /**
   * changeStatus()
   * Aktif/nonaktif/banned/pending. Jika nonaktif/banned, refresh
   * token user direvoke.
   */
  async changeStatus(
    id: string,
    dto: ChangeUserStatusDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    if (id === actor.id) {
      throw new BadRequestException('Anda tidak dapat mengubah status akun sendiri');
    }
    await this.assertManageable(id, actor);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: safeUserSelect,
    });

    if (dto.status === UserStatus.INACTIVE || dto.status === UserStatus.BANNED) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.write({
      userId: actor.id,
      action: 'USER_CHANGE_STATUS',
      entity: 'User',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { status: dto.status },
    });

    return updated;
  }

  /**
   * resetPassword()
   * Admin men-set password baru untuk user lain.
   * Semua refresh token user direvoke.
   */
  async resetPassword(
    id: string,
    dto: ResetUserPasswordDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.assertManageable(id, actor);

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { password: passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.write({
      userId: actor.id,
      action: 'USER_RESET_PASSWORD_BY_ADMIN',
      entity: 'User',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * assertManageable()
   * Cek user target ada & boleh dimanage oleh actor.
   * Aturan: ADMIN_DINAS tidak boleh menyentuh user SUPER_ADMIN.
   */
  private async assertManageable(
    id: string,
    actor: AuthUser,
  ): Promise<User & { role: { name: string } }> {
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan');

    if (actor.role !== 'SUPER_ADMIN' && target.role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException('Tidak diizinkan memanipulasi akun SUPER_ADMIN');
    }
    return target;
  }

  /**
   * assertUniqueIdentifiers()
   * Validasi awal email/username/phone belum dipakai.
   */
  private async assertUniqueIdentifiers(
    email: string,
    username?: string,
    phone?: string,
  ): Promise<void> {
    const conditions: Prisma.UserWhereInput[] = [{ email }];
    if (username) conditions.push({ username });
    if (phone) conditions.push({ phone });

    const exists = await this.prisma.user.findFirst({ where: { OR: conditions } });
    if (!exists) return;

    if (exists.email === email) throw new ConflictException('Email sudah terdaftar');
    if (username && exists.username === username) throw new ConflictException('Username sudah dipakai');
    if (phone && exists.phone === phone) throw new ConflictException('Nomor HP sudah dipakai');
  }

  /**
   * hashPassword()
   * Hash password bcrypt dengan salt round dari env.
   */
  private async hashPassword(plain: string): Promise<string> {
    const rounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 10);
    return bcrypt.hash(plain, rounds);
  }
}
