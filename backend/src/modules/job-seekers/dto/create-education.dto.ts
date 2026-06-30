/**
 * File: backend/src/modules/job-seekers/dto/create-education.dto.ts
 * Fungsi: Validasi payload POST /job-seekers/:id/education.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEducationDto {
  @ApiProperty({ example: 'S1', description: 'SD/SMP/SMA/D3/S1/S2/S3' })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  level!: string;

  @ApiProperty({ example: 'Universitas Hasanuddin' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  institution!: string;

  @ApiPropertyOptional({ example: 'Teknik Informatika' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  major?: string;

  @ApiProperty({ example: 2018 })
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  startYear!: number;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  endYear?: number;

  @ApiPropertyOptional({ example: 3.5, description: 'IPK (0.00 - 4.00)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(4)
  gpa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
