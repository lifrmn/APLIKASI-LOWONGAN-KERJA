/**
 * File: backend/src/modules/chat/chat.service.ts
 * Fungsi:
 *  - Logika bisnis Chat & Messages:
 *      createChat, listChats, findChat, removeChat (soft),
 *      sendMessage, listMessages, markRead, removeMessage (soft),
 *      unreadCount, assertParticipant.
 *  - Notifikasi otomatis ke peserta lain saat ada pesan baru via
 *    NotificationsService.notifyUsers.
 *  - Realtime dispatch dilakukan oleh caller (controller / gateway)
 *    untuk menghindari circular dependency dengan ChatGateway.
 *  - Audit log untuk delete chat & delete message.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Chat,
  ChatType,
  Message,
  MessageType,
  NotificationType,
  Prisma,
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
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { FilterChatDto } from './dto/filter-chat.dto';
import { FilterMessageDto } from './dto/filter-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_DINAS']);

const chatInclude = {
  participants: {
    include: {
      user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
  job: { select: { id: true, title: true } },
  application: { select: { id: true, status: true } },
} satisfies Prisma.ChatInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ============================================================
  //                             CHAT
  // ============================================================

  /**
   * createChat()
   * Buat chat baru. Pembuat otomatis menjadi participant.
   * - APPLICATION: applicationId wajib + auto-add jobSeeker user &
   *   pemilik perusahaan.
   * - JOB: jobId wajib.
   * - PRIVATE: minimal 1 peserta lain.
   */
  async createChat(dto: CreateChatDto, actor: AuthUser, ctx: RequestContext) {
    const participantIds = new Set<string>(dto.participantIds ?? []);
    participantIds.add(actor.id);

    if (dto.type === ChatType.APPLICATION) {
      if (!dto.applicationId) {
        throw new BadRequestException('applicationId wajib untuk chat tipe APPLICATION');
      }
      const application = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, deletedAt: null },
        include: {
          jobSeeker: { select: { userId: true } },
          job: { select: { id: true, company: { select: { userId: true } } } },
        },
      });
      if (!application) throw new NotFoundException('Lamaran tidak ditemukan');

      participantIds.add(application.jobSeeker.userId);
      if (application.job?.company?.userId) {
        participantIds.add(application.job.company.userId);
      }
    }

    if (dto.type === ChatType.JOB) {
      if (!dto.jobId) {
        throw new BadRequestException('jobId wajib untuk chat tipe JOB');
      }
      const job = await this.prisma.job.findFirst({
        where: { id: dto.jobId, deletedAt: null },
      });
      if (!job) throw new NotFoundException('Lowongan tidak ditemukan');
    }

    if (dto.type === ChatType.PRIVATE && participantIds.size < 2) {
      throw new BadRequestException('Chat PRIVATE memerlukan minimal 1 peserta lain');
    }

    // Validasi semua user ada & tidak terhapus
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...participantIds] }, deletedAt: null },
      select: { id: true },
    });
    if (users.length !== participantIds.size) {
      throw new BadRequestException('Sebagian user peserta tidak valid');
    }

    const created = await this.prisma.chat.create({
      data: {
        type: dto.type,
        title: dto.title,
        jobId: dto.jobId ?? null,
        applicationId: dto.applicationId ?? null,
        createdById: actor.id,
        participants: {
          createMany: {
            data: [...participantIds].map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
      include: chatInclude,
    });

    return created;
  }

  /**
   * listChats()
   * Daftar chat tempat user login menjadi peserta (paginated).
   */
  async listChats(actor: AuthUser, query: FilterChatDto): Promise<PaginatedResult<Chat>> {
    const params = getPaginationParams(query);

    const where: Prisma.ChatWhereInput = {
      deletedAt: null,
      participants: { some: { userId: actor.id } },
      ...(query.type && { type: query.type }),
      ...(query.jobId && { jobId: query.jobId }),
      ...(query.applicationId && { applicationId: query.applicationId }),
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { messages: { some: { content: { contains: params.search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.chat.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          ...chatInclude,
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.chat.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * findChat()
   * Detail chat. Akses: peserta atau admin.
   */
  async findChat(id: string, actor: AuthUser) {
    const chat = await this.prisma.chat.findFirst({
      where: { id, deletedAt: null },
      include: chatInclude,
    });
    if (!chat) throw new NotFoundException('Chat tidak ditemukan');
    await this.assertParticipantOrAdmin(id, actor);
    return chat;
  }

  /**
   * removeChat()
   * Soft delete. Hanya pembuat chat atau admin.
   */
  async removeChat(id: string, actor: AuthUser, ctx: RequestContext): Promise<void> {
    const chat = await this.prisma.chat.findFirst({
      where: { id, deletedAt: null },
    });
    if (!chat) throw new NotFoundException('Chat tidak ditemukan');

    if (!ADMIN_ROLES.has(actor.role) && chat.createdById !== actor.id) {
      throw new ForbiddenException('Hanya pembuat chat atau admin yang dapat menghapus');
    }

    await this.prisma.chat.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'CHAT_DELETE',
      entity: 'Chat',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  // ============================================================
  //                           MESSAGES
  // ============================================================

  /**
   * sendMessage()
   * Simpan pesan baru di chat, update chat.updatedAt, dan kirim
   * notifikasi ke peserta lain.
   * Caller (controller/gateway) bertanggung jawab untuk emit ke
   * room WebSocket setelah service mengembalikan record.
   */
  async sendMessage(chatId: string, actor: AuthUser, dto: SendMessageDto): Promise<Message> {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, deletedAt: null },
      include: { participants: { select: { userId: true } } },
    });
    if (!chat) throw new NotFoundException('Chat tidak ditemukan');
    const isMember = chat.participants.some((p) => p.userId === actor.id);
    if (!isMember) {
      throw new ForbiddenException('Anda bukan peserta chat ini');
    }

    if (!dto.content && !dto.fileId) {
      throw new BadRequestException('content atau fileId wajib diisi');
    }

    let fileId: string | null = null;
    if (dto.fileId) {
      const file = await this.prisma.uploadedFile.findFirst({
        where: { id: dto.fileId, deletedAt: null },
      });
      if (!file) throw new BadRequestException('fileId tidak valid');
      fileId = file.id;
    }

    const messageType =
      dto.messageType ?? (fileId ? MessageType.FILE : MessageType.TEXT);

    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: {
          chatId,
          senderId: actor.id,
          content: dto.content,
          fileId,
          messageType,
        },
      });
      await tx.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
      return m;
    });

    // Notifikasi best-effort ke peserta lain
    const recipientIds = chat.participants
      .map((p) => p.userId)
      .filter((id) => id !== actor.id);
    if (recipientIds.length > 0) {
      await this.notifications.notifyUsers(recipientIds, {
        type: NotificationType.CHAT_MESSAGE,
        title: 'Pesan baru',
        message: (dto.content ?? '[Lampiran]').slice(0, 140),
        data: { chatId, messageId: message.id, senderId: actor.id },
      });
    }

    return message;
  }

  /**
   * listMessages()
   * Pesan dalam chat (paginated, terbaru dulu).
   */
  async listMessages(
    chatId: string,
    actor: AuthUser,
    query: FilterMessageDto,
  ): Promise<PaginatedResult<Message>> {
    await this.assertParticipantOrAdmin(chatId, actor);

    const params = getPaginationParams(query);
    const where: Prisma.MessageWhereInput = { chatId, deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          sender: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
          file: true,
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, params.page, params.limit) };
  }

  /**
   * markRead()
   * Update lastReadAt participant aktor pada chat tertentu.
   * Mengembalikan timestamp baru untuk dipakai oleh gateway.
   */
  async markRead(chatId: string, actor: AuthUser): Promise<{ chatId: string; userId: string; lastReadAt: Date }> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: actor.id } },
    });
    if (!participant) {
      throw new ForbiddenException('Anda bukan peserta chat ini');
    }

    const now = new Date();
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId: actor.id } },
      data: { lastReadAt: now },
    });

    return { chatId, userId: actor.id, lastReadAt: now };
  }

  /**
   * removeMessage()
   * Soft delete pesan. Hanya pengirim atau admin.
   */
  async removeMessage(
    chatId: string,
    messageId: string,
    actor: AuthUser,
    ctx: RequestContext,
  ): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, chatId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Pesan tidak ditemukan');

    if (!ADMIN_ROLES.has(actor.role) && message.senderId !== actor.id) {
      throw new ForbiddenException('Hanya pengirim atau admin yang dapat menghapus pesan');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'MESSAGE_DELETE',
      entity: 'Message',
      entityId: messageId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { chatId },
    });
  }

  /**
   * unreadCount()
   * Hitung total pesan belum dibaca user di semua chat-nya.
   * Pesan dianggap belum dibaca bila createdAt > participant.lastReadAt
   * (atau lastReadAt null) DAN senderId != actor.id.
   */
  async unreadCount(actor: AuthUser): Promise<{ total: number }> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId: actor.id, chat: { deletedAt: null } },
      select: { chatId: true, lastReadAt: true },
    });

    if (participants.length === 0) return { total: 0 };

    // Hitung per-chat secara paralel
    const counts = await Promise.all(
      participants.map((p) =>
        this.prisma.message.count({
          where: {
            chatId: p.chatId,
            deletedAt: null,
            senderId: { not: actor.id },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        }),
      ),
    );

    return { total: counts.reduce((a, b) => a + b, 0) };
  }

  // ============================================================
  //                        AUTHORIZATION
  // ============================================================

  /**
   * assertParticipantOrAdmin()
   * Pastikan user adalah peserta chat (atau admin).
   * Dipakai REST controller & gateway.
   */
  async assertParticipantOrAdmin(chatId: string, actor: AuthUser): Promise<void> {
    if (ADMIN_ROLES.has(actor.role)) return;
    const member = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: actor.id } },
    });
    if (!member) throw new ForbiddenException('Anda bukan peserta chat ini');
  }

  /**
   * isParticipant()
   * Versi non-throw untuk dipakai gateway.
   */
  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    if (!chatId || !userId) return false;
    const member = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    return !!member;
  }

  /**
   * getParticipantIds()
   * Daftar userId peserta chat (untuk emit ke room / notifikasi).
   */
  async getParticipantIds(chatId: string): Promise<string[]> {
    const members = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }
}
