/**
 * File: backend/src/common/dto/api-response.dto.ts
 * Fungsi:
 *  - Mendefinisikan kontrak format response API yang konsisten
 *    untuk seluruh endpoint backend.
 *  - Format sukses, error, dan paginated mengikuti spesifikasi
 *    yang sudah ditetapkan.
 *
 * Format yang didukung:
 *  Success:
 *    { success: true, message: "...", data: {...} }
 *  Error:
 *    { success: false, message: "...", error: {...} }
 *  Paginated:
 *    { success: true, message: "...", data: [...], meta: {...} }
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * PaginationMeta
 * Metadata untuk response yang berbentuk paginated list.
 */
export class PaginationMeta {
  @ApiProperty({ example: 1, description: 'Halaman saat ini (1-based)' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Jumlah item per halaman' })
  limit!: number;

  @ApiProperty({ example: 100, description: 'Total item keseluruhan' })
  total!: number;

  @ApiProperty({ example: 10, description: 'Total halaman' })
  totalPages!: number;
}

/**
 * ApiSuccessResponse<T>
 * Bentuk standar response sukses.
 */
export class ApiSuccessResponse<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Data berhasil diproses' })
  message!: string;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ required: false, type: () => PaginationMeta })
  meta?: PaginationMeta;
}

/**
 * ApiErrorPayload
 * Detail isi field `error` pada response error.
 */
export class ApiErrorPayload {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'BAD_REQUEST' })
  code!: string;

  @ApiProperty({ required: false, description: 'Detail error tambahan (validation, dsb)' })
  details?: unknown;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path!: string;

  @ApiProperty({ example: '2026-06-30T08:12:00.000Z' })
  timestamp!: string;
}

/**
 * ApiErrorResponse
 * Bentuk standar response error.
 */
export class ApiErrorResponse {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 'Terjadi kesalahan' })
  message!: string;

  @ApiProperty({ type: () => ApiErrorPayload })
  error!: ApiErrorPayload;
}
