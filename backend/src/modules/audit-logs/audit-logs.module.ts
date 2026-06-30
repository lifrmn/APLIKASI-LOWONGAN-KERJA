/**
 * File: backend/src/modules/audit-logs/audit-logs.module.ts
 * Fungsi: Mendaftarkan AuditLogsController.
 *         AuditLogsService sudah disediakan global oleh DatabaseModule
 *         (dipakai juga oleh module lain untuk menulis audit log).
 */

import { Module } from '@nestjs/common';

import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
})
export class AuditLogsModule {}
