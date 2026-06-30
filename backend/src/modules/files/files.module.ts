/**
 * File: backend/src/modules/files/files.module.ts
 * Fungsi: Mendaftarkan controller & service Files.
 *         Mengekspor FilesService agar modul lain (JobSeekers,
 *         Companies, Applications) bisa memakainya untuk store file.
 */

import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
