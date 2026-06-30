/**
 * File: backend/src/modules/roles/roles.module.ts
 * Fungsi: Mendaftarkan controller & service roles. Mengekspor
 *         RolesService agar modul lain (Users) bisa lookup role.
 */

import { Module } from '@nestjs/common';

import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
