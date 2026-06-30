/**
 * File: backend/src/modules/notifications/notifications.module.ts
 * Fungsi: Mendaftarkan controller & service Notifications.
 *         Mengekspor NotificationsService agar modul lain bisa
 *         memakai helper notifyUser/notifyUsers.
 */

import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
