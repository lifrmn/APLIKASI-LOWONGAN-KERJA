/**
 * File: backend/src/modules/users/users.module.ts
 * Fungsi: Mendaftarkan controller & service users.
 */

import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
