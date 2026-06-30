/**
 * File: backend/src/modules/job-seekers/dto/update-experience.dto.ts
 * Fungsi: Validasi payload PATCH /job-seekers/:id/experiences/:experienceId.
 */

import { PartialType } from '@nestjs/swagger';

import { CreateExperienceDto } from './create-experience.dto';

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}
