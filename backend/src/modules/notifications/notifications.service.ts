/**
 * File: backend/src/modules/notifications/notifications.service.ts
 * Fungsi:
 *  - Logika bisnis NotificationsModule:
 *      list (per user), unreadCount, detail, create (single/bulk/role/
 *      announcement), markRead, markAllRead, soft delete.
 *  - Memuat method internal `notifyUser` / `notifyUsers` yang dapat
 *    dipanggil module lain (export via FilesModule pattern? No —
 *    NotificationsService di-export dari module).
 *  - Persiapan FCM & WebSocket: setelah persist ke DB, dispatch ke
 *    `dispatchRealtime()` (saat ini noop / log; nanti diinjeksi
 *    NotificationsGateway & FcmService).
 *  - Audit log untuk announcement, bulk, dan delete.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateBulkNotificationDto } from './dto/create-bulk-notification.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateRoleNotificationDto } from './dto/create-role-notification.dto';
import { FilterNotificationDto } from './dto/filter-notification.dto';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);
const ANNOUNCEMENT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ============================================================
  //                              READ
  // ============================================================

  /**
   * listForUser()
   * Daftar notifikasi milik user login (paginated + filter).
   */
  async listForUser(
    actor: AuthUser,
    query: FilterNotificationDto,
  ): Promise<PaginatedResult<Notification>> {
    const params = getPaginationParams(query);

    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      deletedAt: null,
      ...(query.type && { type: query.type }),
      ...(typeof query.isRead === 'boolean' && { isRead: query.isRead }),
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { message: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * unreadCount()
   */
  async unreadCount(actor: AuthUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: actor.id, isRead: false, deletedAt: null },
    });
    return { count };
  }

  /**
   * findById()
   * Hanya pemilik (atau admin) yang boleh.
   */
  async findById(id: string, actor: AuthUser): Promise<Notification> {
    const notif = await this.prisma.notification.findFirst({
      where: { id, deletedAt: null },
    });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    this.assertOwnerOrAdmin(notif.userId, actor);
    return notif;
  }

  // ============================================================
  //                            CREATE
  // ============================================================

  /**
   * createForUser()
   * POST /notifications — admin saja (mengirim ke user tertentu).
   */
  async createForUser(
    dto: CreateNotificationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<Notification> {
    this.assertAdmin(actor);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User penerima tidak ditemukan');

    const created = await this.persist({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data ?? null,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'NOTIFICATION_SEND',
      entity: 'Notification',
      entityId: created.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { type: dto.type, target: dto.userId },
    });

    return created;
  }

  /**
   * createBulk()
   * POST /notifications/bulk — admin saja.
   * Validasi user yang valid (deletedAt null), skip yang tidak valid.
   */
  async createBulk(
    dto: CreateBulkNotificationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<{ delivered: number; skipped: number }> {
    this.assertAdmin(actor);

    const validUsers = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, deletedAt: null },
      select: { id: true },
    });
    const validIds = validUsers.map((u) => u.id);

    const result = await this.persistMany(validIds, {
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data ?? null,
    });

    await this.audit.write({
      userId: actor.id,
      action: 'NOTIFICATION_SEND_BULK',
      entity: 'Notification',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        type: dto.type,
        delivered: result.delivered,
        requested: dto.userIds.length,
      },
    });

    return { delivered: result.delivered, skipped: dto.userIds.length - validIds.length };
  }

  /**
   * createForRole()
   * POST /notifications/role — admin saja.
   * Kirim ke semua user (deletedAt null) dengan role tertentu.
   */
  async createForRole(
    dto: CreateRoleNotificationDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<{ delivered: number }> {
    this.assertAdmin(actor);

    const role = await this.prisma.role.findFirst({
      where: { name: dto.roleName, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException(`Role "${dto.roleName}" tidak ditemukan`);

    const users = await this.prisma.user.findMany({
      where: { roleId: role.id, deletedAt: null },
      select: { id: true },
    });

    const result = await this.persistMany(
      users.map((u) => u.id),
      {
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data ?? null,
      },
    );

    await this.audit.write({
      userId: actor.id,
      action: 'NOTIFICATION_SEND_ROLE',
      entity: 'Notification',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { role: role.name, type: dto.type, delivered: result.delivered },
    });

    return result;
  }

  /**
   * createAnnouncement()
   * POST /notifications/announcement — hanya SUPER_ADMIN/ADMIN_DINAS.
   * Jika dto.roles kosong → kirim ke semua user.
   */
  async createAnnouncement(
    dto: CreateAnnouncementDto,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<{ delivered: number }> {
    if (!ANNOUNCEMENT_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin yang dapat membuat pengumuman');
    }

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (dto.roles && dto.roles.length > 0) {
      where.role = { name: { in: dto.roles } };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    const result = await this.persistMany(
      users.map((u) => u.id),
      {
        type: NotificationType.ANNOUNCEMENT,
        title: dto.title,
        message: dto.message,
        data: dto.data ?? null,
      },
    );

    await this.audit.write({
      userId: actor.id,
      action: 'NOTIFICATION_ANNOUNCEMENT',
      entity: 'Notification',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        title: dto.title,
        roles: dto.roles ?? 'ALL',
        delivered: result.delivered,
      },
    });

    return result;
  }

  // ============================================================
  //                          MARK / DELETE
  // ============================================================

  /**
   * markRead()
   * Tandai 1 notifikasi sebagai dibaca. Hanya pemilik.
   */
  async markRead(id: string, actor: AuthUser): Promise<Notification> {
    const notif = await this.prisma.notification.findFirst({
      where: { id, deletedAt: null },
    });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (notif.userId !== actor.id) {
      throw new ForbiddenException('Hanya pemilik notifikasi yang dapat menandai sebagai dibaca');
    }
    if (notif.isRead) return notif;

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * markAllRead()
   */
  async markAllRead(actor: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * remove()
   * Soft delete notifikasi.
   *  - Pemilik bisa hapus notifikasinya sendiri.
   *  - Admin bisa hapus milik siapapun.
   */
  async remove(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const notif = await this.prisma.notification.findFirst({
      where: { id, deletedAt: null },
    });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (notif.userId !== actor.id && !ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException('Anda tidak berhak menghapus notifikasi ini');
    }

    await this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'NOTIFICATION_DELETE',
      entity: 'Notification',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                  PUBLIC HELPERS (untuk module lain)
  // ============================================================

  /**
   * notifyUser()
   * Helper untuk module lain (Applications, Companies, dll)
   * agar tidak perlu menulis ke prisma.notification langsung.
   * Selalu best-effort: error ditelan & dilog.
   */
  async notifyUser(params: NotifyParams): Promise<Notification | null> {
    try {
      return await this.persist(params);
    } catch (e) {
      this.logger.warn(`Gagal kirim notifikasi: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * notifyUsers()
   * Bulk version. Skip user yang tidak valid.
   */
  async notifyUsers(
    userIds: string[],
    base: Omit<NotifyParams, 'userId'>,
  ): Promise<{ delivered: number }> {
    if (userIds.length === 0) return { delivered: 0 };
    return this.persistMany(userIds, base);
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  /**
   * persist()
   * Tulis 1 notifikasi ke DB + dispatch realtime/push.
   */
  private async persist(params: NotifyParams): Promise<Notification> {
    const created = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: (params.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    this.dispatchRealtime(created);
    return created;
  }

  /**
   * persistMany()
   * Bulk insert via createMany lalu ambil ulang untuk dispatch.
   */
  private async persistMany(
    userIds: string[],
    base: Omit<NotifyParams, 'userId'>,
  ): Promise<{ delivered: number }> {
    if (userIds.length === 0) return { delivered: 0 };

    const dataPayload = (base.data ?? undefined) as Prisma.InputJsonValue | undefined;

    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: base.type,
        title: base.title,
        message: base.message,
        data: dataPayload,
      })),
    });

    // Dispatch realtime (best-effort) untuk batch terbaru
    if (result.count > 0) {
      const recent = await this.prisma.notification.findMany({
        where: { userId: { in: userIds }, title: base.title, type: base.type },
        orderBy: { createdAt: 'desc' },
        take: userIds.length,
      });
      recent.forEach((n) => this.dispatchRealtime(n));
    }

    return { delivered: result.count };
  }

  /**
   * dispatchRealtime()
   * Placeholder untuk:
   *  - WebSocket emit (NotificationsGateway), dan
   *  - Firebase Cloud Messaging (FcmService).
   * Saat ini hanya log; implementasi gateway/FCM ditambahkan di
   * tahap berikutnya (Tahap 2 / 3).
   */
  private dispatchRealtime(notif: Notification): void {
    this.logger.debug(`Dispatch notif [${notif.type}] → user=${notif.userId} id=${notif.id}`);
    // TODO: gateway.emitToUser(notif.userId, 'notification:new', notif);
    // TODO: fcm.sendToUser(notif.userId, { title: notif.title, body: notif.message ?? '' });
  }

  // ============================================================
  //                        AUTHORIZATION
  // ============================================================

  private assertOwnerOrAdmin(ownerId: string, actor: AuthUser): void {
    if (ADMIN_ROLES.has(actor.role)) return;
    if (ownerId === actor.id) return;
    throw new ForbiddenException('Anda tidak berhak mengakses notifikasi ini');
  }

  private assertAdmin(actor: AuthUser): void {
    if (!ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException('Hanya admin yang dapat mengirim notifikasi ke user lain');
    }
  }
}
