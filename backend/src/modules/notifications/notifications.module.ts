/**
 * File: backend/src/modules/notifications/notifications.module.ts
 * Fungsi: Mendaftarkan controller & service Notifications,
 *         plus WebSocket gateway & FCM service (opsional).
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, FcmService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
