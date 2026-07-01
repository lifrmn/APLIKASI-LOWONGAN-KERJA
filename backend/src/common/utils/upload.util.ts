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
 * MIME_TO_EXT
 * Reverse-mapping dari MIME ke extension SAFE. Ekstensi diambil
 * berdasarkan MIME, bukan `originalname`, untuk mencegah masquerade
 * seperti `avatar.exe` dengan `Content-Type: image/png`.
 */
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * safeExtFromMime()
 * Kembalikan extension aman berdasarkan MIME whitelist. Fallback ke 'bin'
 * jika MIME tidak dikenal (seharusnya tidak terjadi karena fileFilter
 * menolak MIME yang tidak diizinkan).
 */
function safeExtFromMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

/**
 * multerOptions()
 * Builder MulterOptions yang menerapkan:
 *  - destination ke `${UPLOAD_DIR}/<subdir>`
 *  - filename unik: <timestamp>-<random>.<ext-dari-mime>  (bukan dari originalname)
 *  - limit ukuran file
 *  - filter MIME type + alignment dengan ekstensi originalname (best-effort)
 */
export function multerOptions(params: {
  subdir: string;
  allowedMime: readonly string[];
  maxBytes: number;
}): MulterOptions {
  const { subdir, allowedMime, maxBytes } = params;

  // subdir sanitasi: hanya izinkan [a-z0-9-]. Cegah path traversal.
  const safeSubdir = subdir.replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'misc';

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(baseUploadDir(), safeSubdir);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        // Ekstensi diambil dari MIME (bukan filename user) untuk mencegah masquerade.
        const ext = safeExtFromMime(file.mimetype);
        const unique = `${Date.now()}-${randomBytes(12).toString('hex')}.${ext}`;
        cb(null, unique);
      },
    }),
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 20,
      fieldSize: 1024 * 100, // 100KB per field non-file
      headerPairs: 2000,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMime.includes(file.mimetype)) {
        cb(
          new BadRequestException(
            `Tipe file tidak diizinkan (${file.mimetype}). Hanya: ${allowedMime.join(', ')}`,
          ),
          false,
        );
        return;
      }
      // Tambahan: reject filename dgn karakter berbahaya (best-effort logging saja;
      // nama file yg ditulis ke disk sudah acak, jadi ini hanya extra guard).
      if (/[\x00-\x1f/\\]/.test(file.originalname)) {
        cb(new BadRequestException('Nama file mengandung karakter tidak valid'), false);
        return;
      }
      cb(null, true);
    },
  };
}
