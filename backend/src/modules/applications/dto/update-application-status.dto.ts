/**
 * File: backend/src/modules/applications/dto/update-application-status.dto.ts
 * Fungsi: Validasi payload PATCH /applications/:id/status.
 *         Bisa sekalian kirim catatan & info interview opsional
 *         (untuk transisi ke INTERVIEW).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiPropertyOptional({ example: 'Lulus screening dokumen' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  // ----- Optional: data interview sederhana saat status -> INTERVIEW -----

  @ApiPropertyOptional({ example: '2026-07-10T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  interviewScheduledAt?: string;

  @ApiPropertyOptional({ example: 'Kantor Pusat lt. 3' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  interviewLocation?: string;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-def-ghi' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  interviewMeetingLink?: string;
}
