/**
 * File: backend/src/modules/chat/dto/create-chat.dto.ts
 * Fungsi: Validasi payload POST /chats.
 *         Aturan tambahan dicek di service:
 *         - type=APPLICATION → applicationId wajib
 *         - type=JOB → jobId wajib
 *         - type=PRIVATE → minimal 1 peserta lain
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatType } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ enum: ChatType })
  @IsEnum(ChatType)
  type!: ChatType;

  @ApiPropertyOptional({ example: 'Diskusi lamaran #1234' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Daftar User ID peserta tambahan. Pembuat otomatis ikut. Untuk APPLICATION, kandidat & perwakilan perusahaan akan ditambah otomatis bila belum ada.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  participantIds?: string[];

  @ApiPropertyOptional({ description: 'ID lowongan yang dibahas' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'ID lamaran yang dibahas' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}
