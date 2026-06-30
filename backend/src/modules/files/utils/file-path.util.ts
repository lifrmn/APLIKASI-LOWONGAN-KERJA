/**
 * File: backend/src/modules/files/utils/file-path.util.ts
 * Fungsi: Helper resolusi path penyimpanan file:
 *  - baseUploadDir() membaca env UPLOAD_DIR (default ./uploads).
 *  - subdirFor(category) memberikan subfolder per kategori.
 *  - resolveStorageDir(category) memberikan absolute path dan
 *    memastikan folder ada (mkdirSync recursive).
 *  - resolveAbsolutePath() menghasilkan path absolut dari record DB
 *    (path bisa relatif terhadap project root).
 */

import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

import { FileCategory } from '../enums/file-category.enum';

/**
 * baseUploadDir()
 * Mengembalikan root upload dari env, default `./uploads`.
 */
export function baseUploadDir(): string {
  const raw = process.env.UPLOAD_DIR;
  return raw && raw.trim() ? raw : './uploads';
}

/**
 * subdirFor()
 * Subfolder per kategori (relatif terhadap baseUploadDir).
 */
export function subdirFor(category: FileCategory): string {
  switch (category) {
    case FileCategory.CV:
      return 'cv';
    case FileCategory.CERTIFICATE:
      return 'certificates';
    case FileCategory.PORTFOLIO:
      return 'portfolios';
    case FileCategory.PROFILE_PHOTO:
      return 'profile-photos';
    case FileCategory.COMPANY_LOGO:
      return 'company-logos';
    case FileCategory.COMPANY_DOCUMENT:
      return 'company-docs';
    case FileCategory.E_KTP:
      return 'e-ktp';
    case FileCategory.OTHER:
    default:
      return 'misc';
  }
}

/**
 * resolveStorageDir()
 * Path absolut tujuan penyimpanan untuk kategori tertentu.
 * Membuat direktori bila belum ada.
 */
export function resolveStorageDir(category: FileCategory): string {
  const dir = resolve(join(baseUploadDir(), subdirFor(category)));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * resolveAbsolutePath()
 * Pastikan path file (yang tersimpan di DB) menjadi absolute path.
 */
export function resolveAbsolutePath(storedPath: string): string {
  return isAbsolute(storedPath) ? storedPath : resolve(storedPath);
}
