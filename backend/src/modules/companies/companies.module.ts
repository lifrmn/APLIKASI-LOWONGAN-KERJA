/**
 * File: backend/src/modules/companies/companies.module.ts
 * Fungsi: Mendaftarkan controller & service Companies.
 *         Mengekspor CompaniesService agar modul Jobs/Applications
 *         (tahap berikutnya) bisa lookup perusahaan.
 */

import { Module } from '@nestjs/common';

import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
