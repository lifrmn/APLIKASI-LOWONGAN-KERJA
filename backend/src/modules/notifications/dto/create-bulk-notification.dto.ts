/**
 * File: backend/src/modules/notifications/dto/create-bulk-notification.dto.ts
 * Fungsi: Validasi payload POST /notifications/bulk
 *         (kirim notifikasi ke banyak user sekaligus).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBulkNotificationDto {
  @ApiProperty({
    type: [String],
    description: 'Daftar User ID penerima',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  userIds!: string[];

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ example: 'Pengingat penting' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
