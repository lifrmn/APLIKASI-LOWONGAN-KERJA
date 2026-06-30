/**
 * File: backend/src/modules/notifications/dto/create-notification.dto.ts
 * Fungsi: Validasi payload POST /notifications (kirim ke satu user).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID penerima notifikasi' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ example: 'Pengingat verifikasi' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'Silakan lengkapi dokumen verifikasi perusahaan.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Payload tambahan (JSON), mis. { applicationId, jobId, action }',
    example: { applicationId: 'uuid' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
