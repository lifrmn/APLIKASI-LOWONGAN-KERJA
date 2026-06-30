/**
 * File: backend/src/modules/files/dto/update-file.dto.ts
 * Fungsi: Validasi payload PATCH /files/:id.
 *         Hanya field "isPublic" yang dapat di-toggle oleh admin/owner.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFileDto {
  @ApiPropertyOptional({ example: true, description: 'Tandai file dapat diakses publik' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublic?: boolean;
}
