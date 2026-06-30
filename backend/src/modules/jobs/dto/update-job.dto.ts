/**
 * File: backend/src/modules/jobs/dto/update-job.dto.ts
 * Fungsi: Validasi payload PATCH /jobs/:id.
 *         companyId tidak boleh diubah lewat endpoint ini.
 */

import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateJobDto } from './create-job.dto';

export class UpdateJobDto extends PartialType(OmitType(CreateJobDto, ['companyId'] as const)) {}
