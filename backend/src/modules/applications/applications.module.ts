/**
 * File: backend/src/modules/applications/applications.module.ts
 * Fungsi: Mendaftarkan controller & service Applications.
 *         Mengekspor ApplicationsService agar InterviewsModule /
 *         DashboardModule (tahap berikutnya) bisa pakai.
 */

import { Module } from '@nestjs/common';

import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
