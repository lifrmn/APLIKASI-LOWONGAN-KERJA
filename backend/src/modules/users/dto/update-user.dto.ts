/**
 * File: backend/src/modules/users/dto/update-user.dto.ts
 * Fungsi: Validasi payload PATCH /users/:id.
 *         Field password, roleName, status di-handle di endpoint khusus.
 */

import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'roleName', 'status'] as const),
) {}
