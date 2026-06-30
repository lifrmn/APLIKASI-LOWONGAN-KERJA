/**
 * File: backend/src/modules/files/enums/file-category.enum.ts
 * Fungsi: Re-export enum FileCategory dari Prisma agar dipakai
 *         konsisten oleh controller/service/DTO di FilesModule.
 *         Juga menyediakan daftar urut untuk Swagger / validation.
 */

import { FileCategory } from '@prisma/client';

export { FileCategory };

export const FILE_CATEGORIES: ReadonlyArray<FileCategory> = [
  FileCategory.CV,
  FileCategory.CERTIFICATE,
  FileCategory.PORTFOLIO,
  FileCategory.PROFILE_PHOTO,
  FileCategory.COMPANY_LOGO,
  FileCategory.COMPANY_DOCUMENT,
  FileCategory.E_KTP,
  FileCategory.OTHER,
];
