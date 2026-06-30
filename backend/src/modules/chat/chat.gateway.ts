/**
 * File: backend/src/modules/chat/chat.gateway.ts
 * Fungsi:
 *  - WebSocket gateway (Socket.IO namespace '/chat').
 *  - Validasi JWT di handshake.auth.token.
 *  - Event yang ditangani:
 *      Client emit:  joinChat, leaveChat, sendMessage, typing, readMessage
 *      Server emit:  newMessage, userTyping, messageRead, chatUpdated, error
 *  - Memakai ChatService untuk semua mutasi data agar logika
 *    REST & WS konsisten (single source of truth).
 */

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Konversi chatId → nama room Socket.IO.
 */
const roomOf = (chatId: string): string => `chat:${chatId}`;

interface AuthedSocket extends Socket {
  data: { user?: AuthUser };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  // ============================================================
  //                       CONNECTION LIFECYCLE
  // ============================================================

  /**
   * handleConnection()
   * Verifikasi JWT yang dikirim via `auth.token` saat handshake.
   * Bila valid, simpan AuthUser pada socket.data; bila tidak,
   * emit 'error' lalu putuskan koneksi.
   */
  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new UnauthorizedException('Token tidak ditemukan');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });
      if (!user || user.deletedAt || user.status === 'BANNED' || user.status === 'INACTIVE') {
        throw new UnauthorizedException('User tidak aktif');
      }

      client.data.user = {
        id: user.id,
        email: user.email,
        role: user.role.name,
      };
      this.logger.log(`Socket connected: ${client.id} (user=${user.id})`);
    } catch (e) {
      client.emit('error', { message: (e as Error).message || 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // ============================================================
  //                      CLIENT-EMITTED EVENTS
  // ============================================================

  /**
   * 'joinChat' { chatId }
   * Subscribe socket ke room chat:<chatId> setelah validasi
   * keanggotaan.
   */
  @SubscribeMessage('joinChat')
  async onJoinChat(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: string },
  ): Promise<void> {
    const user = this.requireUser(client);
    if (!body?.chatId) return this.emitError(client, 'chatId wajib diisi');

    const ok = await this.chat.isParticipant(body.chatId, user.id);
    if (!ok) return this.emitError(client, 'Anda bukan peserta chat ini');

    await client.join(roomOf(body.chatId));
    client.emit('chatUpdated', { chatId: body.chatId, joined: true });
  }

  /**
   * 'leaveChat' { chatId }
   */
  @SubscribeMessage('leaveChat')
  async onLeaveChat(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: string },
  ): Promise<void> {
    if (!body?.chatId) return;
    await client.leave(roomOf(body.chatId));
    client.emit('chatUpdated', { chatId: body.chatId, joined: false });
  }

  /**
   * 'sendMessage' { chatId, content?, fileId?, messageType? }
   * Persist via ChatService + broadcast 'newMessage' ke room.
   */
  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: string } & SendMessageDto,
  ): Promise<void> {
    const user = this.requireUser(client);
    if (!body?.chatId) return this.emitError(client, 'chatId wajib diisi');

    try {
      const message = await this.chat.sendMessage(body.chatId, user, {
        content: body.content,
        fileId: body.fileId,
        messageType: body.messageType,
      });
      this.emitNewMessage(body.chatId, message);
    } catch (e) {
      this.emitError(client, (e as Error).message);
    }
  }

  /**
   * 'typing' { chatId, isTyping }
   * Broadcast ke room (kecuali pengirim) bahwa user sedang mengetik.
   */
  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: string; isTyping?: boolean },
  ): void {
    const user = this.requireUser(client);
    if (!body?.chatId) return;
    client.to(roomOf(body.chatId)).emit('userTyping', {
      chatId: body.chatId,
      userId: user.id,
      isTyping: body.isTyping ?? true,
    });
  }

  /**
   * 'readMessage' { chatId }
   * Tandai chat sebagai dibaca + broadcast 'messageRead' ke room.
   */
  @SubscribeMessage('readMessage')
  async onReadMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: string },
  ): Promise<void> {
    const user = this.requireUser(client);
    if (!body?.chatId) return this.emitError(client, 'chatId wajib diisi');

    try {
      const payload = await this.chat.markRead(body.chatId, user);
      this.server.to(roomOf(body.chatId)).emit('messageRead', payload);
    } catch (e) {
      this.emitError(client, (e as Error).message);
    }
  }

  // ============================================================
  //                       SERVER-SIDE EMITTERS
  //  (Dipanggil oleh controller untuk konsistensi REST ↔ WS)
  // ============================================================

  emitNewMessage(chatId: string, message: unknown): void {
    this.server?.to(roomOf(chatId)).emit('newMessage', { chatId, message });
  }

  emitChatUpdated(chatId: string, payload: unknown): void {
    this.server?.to(roomOf(chatId)).emit('chatUpdated', { chatId, ...((payload as object) ?? {}) });
  }

  emitMessageRead(chatId: string, payload: unknown): void {
    this.server?.to(roomOf(chatId)).emit('messageRead', { chatId, ...((payload as object) ?? {}) });
  }

  // ============================================================
  //                          INTERNAL HELPERS
  // ============================================================

  private extractToken(client: AuthedSocket): string | undefined {
    const fromAuth = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim();
    }
    const fromQuery = client.handshake.query?.token;
    if (typeof fromQuery === 'string') return fromQuery;
    return undefined;
  }

  private requireUser(client: AuthedSocket): AuthUser {
    const user = client.data.user;
    if (!user) {
      this.emitError(client, 'Unauthorized');
      throw new UnauthorizedException();
    }
    return user;
  }

  private emitError(client: AuthedSocket, message: string): void {
    client.emit('error', { message });
  }
}
