/**
 * File: backend/src/modules/notifications/enums/notification-type.enum.ts
 * Fungsi: Re-export enum NotificationType dari Prisma + daftar
 *         untuk Swagger / validator.
 */

import { NotificationType } from '@prisma/client';

export { NotificationType };

export const NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = [
  NotificationType.SYSTEM,
  NotificationType.APPLICATION_STATUS,
  NotificationType.INTERVIEW,
  NotificationType.COMPANY_VERIFICATION,
  NotificationType.JOB_RECOMMENDATION,
  NotificationType.CHAT_MESSAGE,
  NotificationType.ANNOUNCEMENT,
];
