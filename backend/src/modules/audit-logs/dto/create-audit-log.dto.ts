/**
 * File: backend/src/modules/audit-logs/dto/create-audit-log.dto.ts
 * Fungsi: Validasi payload bila ada endpoint admin untuk
 *         membuat audit log manual (jarang dipakai; service-to-service
 *         memanggil AuditLogsService.create() langsung). DTO ini juga
 *         berfungsi sebagai dokumentasi tipe.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAuditLogDto {
  @ApiPropertyOptional({ description: 'User ID terkait' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'CREATE', description: 'Kode action (UPPER_SNAKE_CASE)' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  action!: string;

  @ApiPropertyOptional({ example: 'JOBS' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;

  @ApiPropertyOptional({ example: 'Membuat lowongan Backend Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Job' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Payload tambahan (JSON)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
