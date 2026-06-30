/**
 * File: backend/src/modules/companies/dto/update-company-status.dto.ts
 * Fungsi: Validasi payload PATCH /companies/:id/status.
 *         Mengaktifkan / menonaktifkan perusahaan.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateCompanyStatusDto {
  @ApiProperty({ example: true, description: 'true = aktif, false = nonaktif' })
  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}
