/**
 * File: backend/src/modules/dashboard/dto/dashboard-filter.dto.ts
 * Fungsi: Query DTO untuk endpoint dashboard.
 *         Filter waktu (startDate/endDate) berlaku untuk
 *         endpoint yang menerima rentang tanggal.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DashboardFilterDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Awal rentang (ISO date)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Akhir rentang (ISO date)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
