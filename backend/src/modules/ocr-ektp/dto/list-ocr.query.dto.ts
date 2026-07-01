/**
 * File: backend/src/modules/ocr-ektp/dto/list-ocr.query.dto.ts
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OcrStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListOcrQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: OcrStatus })
  @IsOptional() @IsEnum(OcrStatus)
  status?: OcrStatus;

  @ApiPropertyOptional({ description: 'Filter userId (admin)' })
  @IsOptional() @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Pencarian pada fullName atau NIK penuh' })
  @IsOptional() @IsString()
  search?: string;
}
