/**
 * File: backend/src/modules/permissions/dto/update-permission.dto.ts
 * Fungsi: Validasi payload PATCH /permissions/:id.
 */

import { PartialType } from '@nestjs/swagger';

import { CreatePermissionDto } from './create-permission.dto';

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
