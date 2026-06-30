/**
 * File: backend/src/common/utils/upload.util.ts
 * Fungsi:
 *  - Helper konfigurasi Multer (disk storage) untuk endpoint upload.
 *  - Menyediakan factory `multerOptions()` yang menerima daftar
 *    MIME yang diizinkan + ukuran maksimal + subfolder kategori.
 *  - File disimpan di `${UPLOAD_DIR}/<subdir>/<unique-filename>`.
 *  - Subfolder dibuat otomatis bila belum ada.
 *
 * Dipakai oleh:
 *  - JobSeekersController (upload-cv, upload-certificate, upload-portfolio)
 *  - FilesModule (tahap berikutnya)
 */

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/**
 * MB
 * Helper konstanta: konversi MB ke byte.
 */
export const MB = (n: number): number => n * 1024 * 1024;

/**
 * Preset MIME type untuk berbagai kategori upload.
 */
export const ALLOWED_MIME = {
  CV: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  CERTIFICATE: ['application/pdf', 'image/jpeg', 'image/png'],
  PORTFOLIO: ['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'application/x-zip-compressed'],
  PROFILE_PHOTO: ['image/jpeg', 'image/png', 'image/webp'],
  COMPANY_LOGO: ['image/jpeg', 'image/png'],
  COMPANY_DOCUMENT: ['application/pdf', 'image/jpeg', 'image/png'],
  E_KTP: ['image/jpeg', 'image/png'],
} as const;

/**
 * baseUploadDir()
 * Ambil direktori upload root dari env. Default `./uploads`.
 */
function baseUploadDir(): string {
  return process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim()
    ? process.env.UPLOAD_DIR
    : './uploads';
}

/**
 * multerOptions()
 * Builder MulterOptions yang menerapkan:
 *  - destination ke `${UPLOAD_DIR}/<subdir>`
 *  - filename unik: <timestamp>-<random>.<ext-asli>
 *  - limit ukuran file
 *  - filter MIME type
 */
export function multerOptions(params: {
  subdir: string;
  allowedMime: readonly string[];
  maxBytes: number;
}): MulterOptions {
  const { subdir, allowedMime, maxBytes } = params;

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(baseUploadDir(), subdir);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const unique = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
        cb(null, unique);
      },
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (allowedMime.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new BadRequestException(
            `Tipe file tidak diizinkan (${file.mimetype}). Hanya: ${allowedMime.join(', ')}`,
          ),
          false,
        );
      }
    },
  };
}
