/**
 * File: backend/src/common/utils/api-response.util.ts
 * Fungsi:
 *  - Helper untuk membangun objek response API yang konsisten.
 *  - Dipakai oleh service / controller bila ingin mengembalikan
 *    bentuk response secara eksplisit (selain via interceptor).
 */

import { ApiErrorResponse, ApiSuccessResponse, PaginationMeta } from '../dto/api-response.dto';

/**
 * success()
 * Membuat response sukses standar.
 *
 * @param data    Payload data yang dikirim ke client.
 * @param message Pesan sukses (default: "Data berhasil diproses").
 */
export function success<T>(data: T, message = 'Data berhasil diproses'): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * paginated()
 * Membuat response sukses berisi list + metadata pagination.
 *
 * @param data    Array data hasil query.
 * @param meta    Metadata pagination (page, limit, total, totalPages).
 * @param message Pesan sukses (default: "Data berhasil diambil").
 */
export function paginated<T>(
  data: T[],
  meta: PaginationMeta,
  message = 'Data berhasil diambil',
): ApiSuccessResponse<T[]> {
  return {
    success: true,
    message,
    data,
    meta,
  };
}

/**
 * error()
 * Membuat response error standar (umumnya dipakai oleh global filter).
 *
 * @param message Pesan utama error.
 * @param statusCode HTTP status code.
 * @param code Kode error string (mis. "VALIDATION_ERROR").
 * @param path Path request yang error.
 * @param details Detail tambahan (opsional).
 */
export function error(
  message: string,
  statusCode: number,
  code: string,
  path: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    message,
    error: {
      statusCode,
      code,
      details,
      path,
      timestamp: new Date().toISOString(),
    },
  };
}
