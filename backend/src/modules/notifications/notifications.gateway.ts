/**
 * File: backend/src/modules/notifications/notifications.gateway.ts
 * Fungsi:
 *  - Socket.IO gateway namespace `/notifications`.
 *  - Setelah handshake JWT sukses, klien otomatis di-subscribe ke
 *    room `user:<userId>` sehingga bisa menerima push notif in-app.
 *  - Emit `notification:new` dari NotificationsService.dispatchRealtime.
 */

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { JwtPayload } from '../auth/strategies/jwt.strategy';

const roomOfUser = (userId: string): string => `user:${userId}`;

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string } | undefined)?.token ??
        (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') || null);
      if (!token) throw new UnauthorizedException('Token wajib');

      const payload: JwtPayload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      await client.join(roomOfUser(payload.sub));
      client.emit('connected', { userId: payload.sub });
    } catch (e) {
      this.logger.warn(`notif WS reject: ${(e as Error).message}`);
      client.emit('error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket): void {
    // no-op; user rooms bersih otomatis
  }

  /**
   * emitToUser()
   * Dipanggil NotificationsService untuk push realtime.
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(roomOfUser(userId)).emit(event, payload);
  }
}
