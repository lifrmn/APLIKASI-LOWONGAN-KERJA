/**
 * File: backend/src/modules/users/dto/change-user-role.dto.ts
 * Fungsi: Validasi payload PATCH /users/:id/change-role.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChangeUserRoleDto {
  @ApiProperty({ example: 'HRD', description: 'Nama role baru' })
  @IsString()
  roleName!: string;
}
