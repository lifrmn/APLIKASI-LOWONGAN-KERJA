/**
 * File: backend/src/modules/dashboard/dashboard.module.ts
 * Fungsi: Mendaftarkan controller & service Dashboard. Tidak ada
 *         dependency tambahan karena hanya membaca via PrismaService
 *         (sudah global).
 */

import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
