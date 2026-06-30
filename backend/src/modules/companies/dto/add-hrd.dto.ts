/**
 * File: backend/src/modules/companies/dto/add-hrd.dto.ts
 * Fungsi: Validasi payload POST /companies/:id/hrd.
 *         Menambahkan user (role HRD) ke daftar HRD perusahaan.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddHrdDto {
  @ApiProperty({ description: 'User ID HRD yang akan ditambahkan' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ example: 'HR Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;
}
