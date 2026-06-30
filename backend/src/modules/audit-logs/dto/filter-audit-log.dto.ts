/**
 * File: backend/src/modules/audit-logs/dto/filter-audit-log.dto.ts
 * Fungsi: Query DTO GET /audit-logs — pagination + filter user,
 *         action, module, entity, IP, tanggal.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIP, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterAuditLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'LOGIN' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'JOBS' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ example: 'Job' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
