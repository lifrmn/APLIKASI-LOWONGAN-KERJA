/**
 * File: backend/src/modules/reports/reports.module.ts
 * Fungsi: Mendaftarkan controller & service Reports.
 *         Tidak butuh import tambahan karena PrismaService global
 *         dan util export adalah pure function.
 */

import { Module } from '@nestjs/common';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
