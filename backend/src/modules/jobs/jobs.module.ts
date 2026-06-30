/**
 * File: backend/src/modules/jobs/jobs.module.ts
 * Fungsi: Mendaftarkan controller & service Jobs.
 *         Mengekspor JobsService agar ApplicationsModule (tahap
 *         berikutnya) bisa lookup lowongan.
 */

import { Module } from '@nestjs/common';

import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
