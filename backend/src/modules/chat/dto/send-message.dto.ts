/**
 * File: backend/src/modules/chat/dto/send-message.dto.ts
 * Fungsi: Validasi payload POST /chats/:id/messages dan event
 *         WS 'sendMessage'. Salah satu antara content atau fileId
 *         wajib (divalidasi di service).
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Halo, kapan saya bisa interview?' })
  @ValidateIf((o: SendMessageDto) => !o.fileId)
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content?: string;

  @ApiPropertyOptional({ description: 'ID file pada uploaded_files (untuk pesan FILE/IMAGE)' })
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;
}
