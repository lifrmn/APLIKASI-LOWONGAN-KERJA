/**
 * File: backend/src/modules/job-seekers/dto/create-job-seeker.dto.ts
 * Fungsi: Validasi payload POST /job-seekers
 *         (membuat profil pencari kerja untuk user tertentu).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, WorkStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobSeekerDto {
  @ApiPropertyOptional({
    description:
      'User ID pemilik profil. Wajib bila dibuat oleh admin. Bila JOB_SEEKER membuat profil sendiri, field ini diabaikan.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: '7301010101010001', description: 'NIK 16 digit' })
  @IsOptional()
  @IsString()
  @Length(16, 16, { message: 'NIK harus 16 digit' })
  @Matches(/^\d{16}$/, { message: 'NIK hanya boleh angka' })
  nik?: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({ example: 'Polewali' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  birthPlace?: string;

  @ApiPropertyOptional({ example: '2000-01-15', description: 'Format ISO date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/)
  phone?: string;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

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

  @ApiPropertyOptional({ example: 'S1', description: 'SD/SMP/SMA/D3/S1/S2/S3' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  lastEducation?: string;

  @ApiPropertyOptional({ example: 'Teknik Informatika' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  major?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear?: number;

  @ApiPropertyOptional({ enum: WorkStatus })
  @IsOptional()
  @IsEnum(WorkStatus)
  workStatus?: WorkStatus;

  @ApiPropertyOptional({ example: 5000000, description: 'Ekspektasi gaji (Rupiah)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expectedSalary?: number;

  @ApiPropertyOptional({ example: 'Saya seorang fresh graduate yang...' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  about?: string;
}
