/**
 * File: backend/src/modules/chat/chat.module.ts
 * Fungsi:
 *  - Mendaftarkan ChatController, ChatService, ChatGateway.
 *  - Re-register JwtModule untuk dipakai ChatGateway saat
 *    memverifikasi token WebSocket.
 *  - Import NotificationsModule agar service bisa kirim notifikasi
 *    ke peserta lain saat ada pesan baru.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
