/**
 * File: backend/src/modules/notifications/dto/create-announcement.dto.ts
 * Fungsi: Validasi payload POST /notifications/announcement.
 *         Pengumuman bisa ke semua user, atau dibatasi ke beberapa role.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Job Fair 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'Job Fair akan diselenggarakan pada...' })
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  message!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter penerima berdasarkan role. Kosongkan untuk SEMUA user.',
    example: ['JOB_SEEKER', 'COMPANY'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ description: 'Payload tambahan (JSON)' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
