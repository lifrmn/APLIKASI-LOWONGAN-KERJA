/**
 * File: backend/src/modules/roles/dto/create-role.dto.ts
 * Fungsi: Validasi payload POST /roles.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'ADMIN_DINAS', description: 'Nama role unik (UPPER_SNAKE_CASE)' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'Nama role harus UPPER_SNAKE_CASE' })
  name!: string;

  @ApiPropertyOptional({ example: 'Administrator Dinas Tenaga Kerja' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
