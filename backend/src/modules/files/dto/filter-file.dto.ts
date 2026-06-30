/**
 * File: backend/src/modules/files/dto/filter-file.dto.ts
 * Fungsi: Query DTO GET /files — pagination + filter category,
 *         ownerId, isPublic, mimeType.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterFileDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FileCategory })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory;

  @ApiPropertyOptional({ description: 'Filter berdasarkan owner (admin saja)' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : value,
  )
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
