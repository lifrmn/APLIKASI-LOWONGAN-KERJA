/**
 * File: backend/src/modules/notifications/dto/create-role-notification.dto.ts
 * Fungsi: Validasi payload POST /notifications/role
 *         (kirim notifikasi ke semua user dengan role tertentu).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleNotificationDto {
  @ApiProperty({ example: 'JOB_SEEKER', description: 'Nama role penerima' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  roleName!: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ example: 'Lowongan baru tersedia' })
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
