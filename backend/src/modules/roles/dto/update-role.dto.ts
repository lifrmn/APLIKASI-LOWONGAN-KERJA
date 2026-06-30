/**
 * File: backend/src/modules/roles/dto/update-role.dto.ts
 * Fungsi: Validasi payload PATCH /roles/:id.
 */

import { PartialType } from '@nestjs/swagger';

import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
