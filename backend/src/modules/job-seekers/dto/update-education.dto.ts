/**
 * File: backend/src/modules/job-seekers/dto/update-education.dto.ts
 * Fungsi: Validasi payload PATCH /job-seekers/:id/education/:educationId.
 */

import { PartialType } from '@nestjs/swagger';

import { CreateEducationDto } from './create-education.dto';

export class UpdateEducationDto extends PartialType(CreateEducationDto) {}
