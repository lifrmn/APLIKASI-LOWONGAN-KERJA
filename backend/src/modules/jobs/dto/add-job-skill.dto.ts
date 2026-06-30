/**
 * File: backend/src/modules/jobs/dto/add-job-skill.dto.ts
 * Fungsi: Validasi payload POST /jobs/:id/skills.
 *         Bisa pakai skillId yang sudah ada atau skillName baru.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const JOB_SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
export type JobSkillLevel = (typeof JOB_SKILL_LEVELS)[number];

export class AddJobSkillDto {
  @ApiPropertyOptional({ description: 'ID skill yang sudah ada di master' })
  @ValidateIf((o: AddJobSkillDto) => !o.skillName)
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ description: 'Nama skill baru (find-or-create)' })
  @ValidateIf((o: AddJobSkillDto) => !o.skillId)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  skillName?: string;

  @ApiPropertyOptional({ enum: JOB_SKILL_LEVELS })
  @IsOptional()
  @IsIn(JOB_SKILL_LEVELS as readonly string[])
  level?: JobSkillLevel;

  @ApiPropertyOptional({ example: true, description: 'Apakah wajib' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRequired?: boolean;
}
