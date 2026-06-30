/**
 * File: backend/src/common/interceptors/response.interceptor.ts
 * Fungsi:
 *  - Global interceptor yang membungkus return value dari controller
 *    menjadi format standar:
 *      { success: true, message, data, meta? }
 *  - Jika controller sudah mengembalikan objek yang punya field
 *    `success` (artinya sudah dibentuk manual via helper), interceptor
 *    tidak akan membungkus ulang.
 *  - Jika controller mengembalikan { data, meta, message? }, interceptor
 *    akan memperlakukannya sebagai paginated response.
 */

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiSuccessResponse, PaginationMeta } from '../dto/api-response.dto';

interface MaybePaginated<T> {
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        // Jika controller sudah mengembalikan struktur ApiSuccessResponse,
        // teruskan apa adanya.
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'success' in (payload as Record<string, unknown>)
        ) {
          return payload as unknown as ApiSuccessResponse<T>;
        }

        // Jika controller mengembalikan { data, meta }, anggap paginated.
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in (payload as Record<string, unknown>) &&
          'meta' in (payload as Record<string, unknown>)
        ) {
          const p = payload as unknown as MaybePaginated<T>;
          return {
            success: true,
            message: p.message ?? 'Data berhasil diambil',
            data: p.data,
            meta: p.meta,
          };
        }

        // Default: bungkus sebagai response sukses biasa.
        return {
          success: true,
          message: 'Data berhasil diproses',
          data: payload as T,
        };
      }),
    );
  }
}
