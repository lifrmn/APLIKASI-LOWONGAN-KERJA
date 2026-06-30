/**
 * File: backend/src/modules/files/utils/file-name.util.ts
 * Fungsi: Helper untuk menghasilkan nama file unik di disk,
 *         berbasis timestamp + random hex, mempertahankan extension asli.
 *         Mencegah:
 *          - tabrakan nama
 *          - leak nama asli pengguna sebagai key penyimpanan
 */

import { randomBytes } from 'crypto';
import { extname } from 'path';

/**
 * sanitizeExtension()
 * Bersihkan extension menjadi karakter aman: hanya huruf/angka kecil,
 * 1-8 karakter, dengan titik di depan.
 */
function sanitizeExtension(originalName: string): string {
  const raw = extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  if (!raw || raw === '.') return '';
  return raw.length > 9 ? raw.slice(0, 9) : raw; // titik + max 8 char
}

/**
 * generateUniqueFilename()
 * Hasilkan nama file storage unik, format:
 *   <timestamp>-<12 hex>.<ext>
 */
export function generateUniqueFilename(originalName: string): string {
  const ext = sanitizeExtension(originalName);
  return `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
}

/**
 * extractExtension()
 * Ambil extension (tanpa titik) dari nama file. Mis. "pdf".
 */
export function extractExtension(originalName: string): string | null {
  const e = sanitizeExtension(originalName);
  return e ? e.slice(1) : null;
}
