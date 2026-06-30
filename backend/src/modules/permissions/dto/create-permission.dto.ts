/**
 * File: backend/src/modules/permissions/dto/create-permission.dto.ts
 * Fungsi: Validasi payload POST /permissions.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'user.create', description: 'Kode permission unik, format <resource>.<action>' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, {
    message: 'Format kode harus <resource>.<action>, lower-case, contoh: user.create',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Membuat user baru' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
