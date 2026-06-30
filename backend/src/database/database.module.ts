/**
 * File: backend/src/database/database.module.ts
 * Fungsi:
 *  - Module global yang menyediakan PrismaService ke seluruh
 *    aplikasi tanpa perlu diimport berulang di tiap module.
 */

import { Global, Module } from '@nestjs/common';

import { AuditLogsService } from '../common/services/audit-logs.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, AuditLogsService],
  exports: [PrismaService, AuditLogsService],
})
export class DatabaseModule {}
