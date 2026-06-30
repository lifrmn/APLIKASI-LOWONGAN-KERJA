/**
 * File: backend/src/modules/jobs/dto/create-job.dto.ts
 * Fungsi: Validasi payload POST /jobs (membuat lowongan baru — status default DRAFT).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, WorkType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @ApiPropertyOptional({
    description:
      'Company ID. Wajib bila admin yang membuat. Bila COMPANY/HRD membuat, otomatis diambil dari profil mereka.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Software Engineer Backend (NestJS)' })
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'Kami mencari engineer yang...' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ example: 'Min S1 Teknik Informatika, 2 tahun pengalaman.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  requirement?: string;

  @ApiPropertyOptional({ example: 'Membangun service API, code review, mentoring junior.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  responsibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobCategoryId?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiProperty({ enum: WorkType })
  @IsEnum(WorkType)
  workType!: WorkType;

  @ApiPropertyOptional({ example: 'S1' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  minimumEducation?: string;

  @ApiPropertyOptional({ example: 2, description: 'Pengalaman minimum (tahun)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  minimumExperience?: number;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  salaryVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provinceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  villageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 5, description: 'Jumlah kuota lowongan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quota?: number;
}
