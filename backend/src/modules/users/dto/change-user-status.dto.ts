/**
 * File: backend/src/modules/users/dto/change-user-status.dto.ts
 * Fungsi: Validasi payload PATCH /users/:id/change-status.
 */

import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsEnum(UserStatus)
  status!: UserStatus;
}
