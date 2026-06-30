/**
 * File: backend/src/modules/companies/dto/create-company.dto.ts
 * Fungsi: Validasi payload POST /companies.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiPropertyOptional({
    description:
      'User ID owner perusahaan. Wajib diisi bila admin yang membuat. Diabaikan bila COMPANY membuat sendiri.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'PT Bursa Kerja Sejahtera' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  companyName!: string;

  @ApiPropertyOptional({ example: 'Teknologi Informasi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessField?: string;

  @ApiPropertyOptional({ example: 'Perusahaan IT yang...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'hrd@perusahaan.co.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://perusahaan.co.id' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @ApiPropertyOptional({ example: 'Jl. Industri No. 10' })
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

  @ApiPropertyOptional({ example: -3.4441 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 119.2204 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
