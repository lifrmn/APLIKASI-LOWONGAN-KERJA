/**
 * File: backend/src/modules/job-seekers/dto/list-job-seekers.query.dto.ts
 * Fungsi: Query DTO untuk GET /job-seekers (pagination + filter
 *         workStatus, region, skill, lastEducation).
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListJobSeekersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkStatus })
  @IsOptional()
  @IsEnum(WorkStatus)
  workStatus?: WorkStatus;

  @ApiPropertyOptional({ description: 'ID provinsi' })
  @IsOptional()
  @IsString()
  provinceId?: string;

  @ApiPropertyOptional({ description: 'ID kabupaten/kota' })
  @IsOptional()
  @IsString()
  regencyId?: string;

  @ApiPropertyOptional({ description: 'ID kecamatan' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ description: 'ID desa/kelurahan' })
  @IsOptional()
  @IsString()
  villageId?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan skill ID (UUID)' })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ example: 'S1', description: 'Filter berdasarkan tingkat pendidikan terakhir' })
  @IsOptional()
  @IsString()
  lastEducation?: string;
}
