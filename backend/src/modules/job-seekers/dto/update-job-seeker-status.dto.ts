/**
 * File: backend/src/modules/job-seekers/dto/update-job-seeker-status.dto.ts
 * Fungsi: Validasi payload PATCH /job-seekers/:id/status.
 */

import { ApiProperty } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateJobSeekerStatusDto {
  @ApiProperty({ enum: WorkStatus })
  @IsEnum(WorkStatus)
  workStatus!: WorkStatus;
}
