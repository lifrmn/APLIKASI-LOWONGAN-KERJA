/**
 * File: backend/src/modules/job-seekers/job-seekers.module.ts
 * Fungsi: Mendaftarkan controller & service Job Seeker.
 */

import { Module } from '@nestjs/common';

import { JobSeekersController } from './job-seekers.controller';
import { JobSeekersService } from './job-seekers.service';

@Module({
  controllers: [JobSeekersController],
  providers: [JobSeekersService],
  exports: [JobSeekersService],
})
export class JobSeekersModule {}
