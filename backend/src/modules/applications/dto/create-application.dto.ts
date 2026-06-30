/**
 * File: backend/src/modules/applications/dto/create-application.dto.ts
 * Fungsi: Validasi payload POST /applications.
 *         jobSeekerId akan otomatis di-resolve dari user login
 *         (JOB_SEEKER). Admin yang membuatkan lamaran wajib
 *         menyertakan jobSeekerId.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ description: 'ID lowongan yang dilamar' })
  @IsUUID()
  jobId!: string;

  @ApiPropertyOptional({
    description:
      'ID profil pencari kerja. Diabaikan bila JOB_SEEKER membuat sendiri (diambil dari profil user login). Wajib bila admin yang membuatkan.',
  })
  @IsOptional()
  @IsUUID()
  jobSeekerId?: string;

  @ApiPropertyOptional({
    description: 'ID file CV yang dipakai. Jika kosong, dipakai cvFileId default di profil.',
  })
  @IsOptional()
  @IsUUID()
  cvFileId?: string;

  @ApiPropertyOptional({ example: 'Saya tertarik karena...' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  coverLetter?: string;
}
