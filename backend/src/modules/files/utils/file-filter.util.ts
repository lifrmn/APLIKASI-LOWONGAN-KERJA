/**
 * File: backend/src/modules/files/utils/file-filter.util.ts
 * Fungsi: Helper validasi MIME & ukuran file per kategori,
 *         serta builder MulterOptions yang siap dipakai di
 *         FileInterceptor.
 */

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

import { FileCategory } from '../enums/file-category.enum';
import { generateUniqueFilename } from './file-name.util';
import { resolveStorageDir } from './file-path.util';

export const MB = (n: number): number => n * 1024 * 1024;

/**
 * CATEGORY_RULES
 * Daftar MIME yang diizinkan dan ukuran maksimum per kategori.
 * Default global maksimum 5MB (PORTFOLIO sengaja sedikit lebih besar
 * karena dapat berupa ZIP).
 */
export const CATEGORY_RULES: Record<
  FileCategory,
  { allowedMime: readonly string[]; maxBytes: number }
> = {
  CV: {
    allowedMime: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: MB(5),
  },
  CERTIFICATE: {
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: MB(5),
  },
  PORTFOLIO: {
    allowedMime: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/zip',
      'application/x-zip-compressed',
    ],
    maxBytes: MB(10),
  },
  PROFILE_PHOTO: {
    allowedMime: ['image/jpeg', 'image/png'],
    maxBytes: MB(5),
  },
  COMPANY_LOGO: {
    allowedMime: ['image/jpeg', 'image/png'],
    maxBytes: MB(5),
  },
  COMPANY_DOCUMENT: {
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: MB(5),
  },
  E_KTP: {
    allowedMime: ['image/jpeg', 'image/png'],
    maxBytes: MB(5),
  },
  OTHER: {
    // Default agak permisif tapi tetap dibatasi.
    allowedMime: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: MB(5),
  },
};

/**
 * isValidCategory()
 */
function isValidCategory(value: unknown): value is FileCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_RULES, value);
}

/**
 * pickCategoryFromRequest()
 * Ambil category dari query / body, fallback ke OTHER.
 * Dipakai untuk endpoint generic /files/upload.
 */
function pickCategoryFromRequest(req: { query?: Record<string, unknown>; body?: Record<string, unknown> }): FileCategory {
  const raw = (req.query?.category ?? req.body?.category) as unknown;
  return isValidCategory(raw) ? raw : FileCategory.OTHER;
}

/**
 * multerOptionsForCategory()
 * MulterOptions tetap (statis) untuk kategori yang sudah ditentukan
 * di endpoint khusus (mis. /files/upload-cv).
 */
export function multerOptionsForCategory(category: FileCategory): MulterOptions {
  const rules = CATEGORY_RULES[category];
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, resolveStorageDir(category));
      },
      filename: (_req, file, cb) => {
        cb(null, generateUniqueFilename(file.originalname));
      },
    }),
    limits: { fileSize: rules.maxBytes },
    fileFilter: (_req, file, cb) => {
      if (rules.allowedMime.includes(file.mimetype)) cb(null, true);
      else
        cb(
          new BadRequestException(
            `Tipe file tidak diizinkan untuk ${category} (${file.mimetype}). Hanya: ${rules.allowedMime.join(', ')}`,
          ),
          false,
        );
    },
  };
}

/**
 * multerOptionsGeneric()
 * MulterOptions yang membaca kategori dari `req.query.category` /
 * `req.body.category` saat runtime. Dipakai endpoint /files/upload.
 *
 * Catatan: Multer memanggil destination/fileFilter setelah body field
 * yang muncul SEBELUM file ter-parse. Field 'category' sebaiknya
 * dikirim via query string untuk memastikan tersedia.
 */
export function multerOptionsGeneric(): MulterOptions {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const cat = pickCategoryFromRequest(req as never);
        cb(null, resolveStorageDir(cat));
      },
      filename: (_req, file, cb) => {
        cb(null, generateUniqueFilename(file.originalname));
      },
    }),
    limits: { fileSize: MB(10) }, // batas atas longgar untuk endpoint umum
    fileFilter: (req, file, cb) => {
      const cat = pickCategoryFromRequest(req as never);
      const rules = CATEGORY_RULES[cat];
      if (rules.allowedMime.includes(file.mimetype)) cb(null, true);
      else
        cb(
          new BadRequestException(
            `Tipe file tidak diizinkan untuk ${cat} (${file.mimetype}). Hanya: ${rules.allowedMime.join(', ')}`,
          ),
          false,
        );
    },
  };
}
