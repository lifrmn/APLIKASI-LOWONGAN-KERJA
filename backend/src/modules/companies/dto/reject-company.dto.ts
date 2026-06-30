/**
 * File: backend/src/modules/companies/dto/reject-company.dto.ts
 * Fungsi: Validasi payload PATCH /companies/:id/reject.
 *         Alasan reject wajib diisi.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectCompanyDto {
  @ApiProperty({ example: 'Dokumen legalitas tidak terbaca, mohon upload ulang.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note!: string;
}
