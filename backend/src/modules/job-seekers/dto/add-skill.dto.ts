/**
 * File: backend/src/modules/job-seekers/dto/add-skill.dto.ts
 * Fungsi: Validasi payload POST /job-seekers/:id/skills.
 *         Bisa kirim skillId yang sudah ada di master, atau skillName
 *         (akan find-or-create di tabel skills).
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export class AddSkillDto {
  @ApiPropertyOptional({ description: 'ID skill yang sudah ada di master' })
  @ValidateIf((o: AddSkillDto) => !o.skillName)
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ description: 'Nama skill baru (akan dibuat bila belum ada)' })
  @ValidateIf((o: AddSkillDto) => !o.skillId)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  skillName?: string;

  @ApiPropertyOptional({ enum: SKILL_LEVELS })
  @IsOptional()
  @IsIn(SKILL_LEVELS as readonly string[])
  level?: SkillLevel;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;
}
