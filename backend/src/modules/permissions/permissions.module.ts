/**
 * File: backend/src/modules/permissions/permissions.module.ts
 * Fungsi: Mendaftarkan controller & service permissions.
 */

import { Module } from '@nestjs/common';

import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
