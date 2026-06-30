/**
 * File: backend/src/modules/job-seekers/dto/update-job-seeker.dto.ts
 * Fungsi: Validasi payload PATCH /job-seekers/:id.
 *         workStatus & userId tidak boleh diubah lewat endpoint ini.
 */

import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateJobSeekerDto } from './create-job-seeker.dto';

export class UpdateJobSeekerDto extends PartialType(
  OmitType(CreateJobSeekerDto, ['userId', 'workStatus'] as const),
) {}
