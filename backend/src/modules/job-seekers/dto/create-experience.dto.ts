/**
 * File: backend/src/modules/job-seekers/dto/create-experience.dto.ts
 * Fungsi: Validasi payload POST /job-seekers/:id/experiences.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExperienceDto {
  @ApiProperty({ example: 'PT Maju Jaya' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  company!: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  position!: string;

  @ApiProperty({ example: '2022-07-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2024-06-30', description: 'Kosongkan jika masih bekerja' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
