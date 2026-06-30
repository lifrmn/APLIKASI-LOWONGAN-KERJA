/**
 * File: backend/src/common/dto/pagination-query.dto.ts
 * Fungsi:
 *  - DTO standar untuk query string pagination, search, sort, dan order.
 *  - Dipakai oleh endpoint list (GET /users, /jobs, /companies, dll).
 *  - Sudah dilengkapi @ApiPropertyOptional agar tampil di Swagger.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * SortOrder
 * Arah pengurutan, ASC = naik, DESC = turun.
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Nomor halaman (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    description: 'Jumlah item per halaman',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'developer', description: 'Kata kunci pencarian' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Nama kolom untuk sort' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortOrder, example: SortOrder.DESC, description: 'Arah sort' })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}
