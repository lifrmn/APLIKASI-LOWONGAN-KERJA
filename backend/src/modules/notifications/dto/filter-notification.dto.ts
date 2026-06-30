/**
 * File: backend/src/modules/notifications/dto/filter-notification.dto.ts
 * Fungsi: Query DTO GET /notifications — pagination + filter type & isRead.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterNotificationDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ example: false, description: 'Filter berdasarkan status baca' })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : value,
  )
  @IsBoolean()
  isRead?: boolean;
}
