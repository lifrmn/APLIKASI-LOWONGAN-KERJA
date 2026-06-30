/**
 * File: backend/src/modules/companies/dto/verify-company.dto.ts
 * Fungsi: Validasi payload PATCH /companies/:id/verify.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyCompanyDto {
  @ApiPropertyOptional({ example: 'Dokumen lengkap dan valid.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
