/**
 * File: backend/src/modules/chat/dto/filter-chat.dto.ts
 * Fungsi: Query DTO GET /chats — pagination + filter type.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChatType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterChatDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChatType })
  @IsOptional()
  @IsEnum(ChatType)
  type?: ChatType;

  @ApiPropertyOptional({ description: 'Filter berdasarkan job tertentu' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan lamaran tertentu' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}
