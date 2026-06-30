/**
 * File: backend/src/database/database.module.ts
 * Fungsi:
 *  - Module global yang menyediakan PrismaService ke seluruh
 *    aplikasi tanpa perlu diimport berulang di tiap module.
 */

import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
