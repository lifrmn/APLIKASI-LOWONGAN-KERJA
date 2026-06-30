/**
 * File: backend/src/modules/roles/dto/assign-permission.dto.ts
 * Fungsi: Validasi payload POST /roles/:id/permissions.
 *         Mengaitkan banyak permission ke role sekaligus.
 */

import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignPermissionDto {
  @ApiProperty({
    type: [String],
    description: 'Daftar ID permission yang akan di-assign ke role',
    example: ['1d4d4f6a-...', '2e5e5f7b-...'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissionIds!: string[];
}
