/**
 * File: backend/src/modules/reports/dto/report-filter.dto.ts
 * Fungsi: Query DTO universal untuk endpoint Reports:
 *         pagination + filter waktu, wilayah, status, kategori,
 *         dan opsional jenis pekerjaan / verifikasi.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  VerificationStatus,
  WorkType,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ReportFilterDto extends PaginationQueryDto {
  // -------- Waktu --------
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // -------- Wilayah --------
  @ApiPropertyOptional() @IsOptional() @IsString() provinceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() regencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() villageId?: string;

  // -------- Status / kategori --------
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  applicationStatus?: ApplicationStatus;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  jobStatus?: JobStatus;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: WorkType })
  @IsOptional()
  @IsEnum(WorkType)
  workType?: WorkType;

  @ApiPropertyOptional({ description: 'Filter berdasarkan job category ID' })
  @IsOptional()
  @IsUUID()
  jobCategoryId?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan perusahaan (admin)' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
