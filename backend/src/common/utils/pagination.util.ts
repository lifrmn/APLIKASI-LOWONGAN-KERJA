/**
 * File: backend/src/common/utils/pagination.util.ts
 * Fungsi:
 *  - Helper umum untuk pagination:
 *      - getPaginationParams: normalisasi page/limit + hitung skip/take.
 *      - buildPaginationMeta: menyusun objek meta { page, limit, total, totalPages }.
 *      - paginate: helper one-shot untuk model Prisma (findMany + count).
 *  - Dipakai service-service yang membutuhkan list paginated.
 */

import { PaginationMeta } from '../dto/api-response.dto';
import { PaginationQueryDto, SortOrder } from '../dto/pagination-query.dto';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy?: string;
  order: SortOrder;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * getPaginationParams()
 * Mengubah PaginationQueryDto menjadi parameter siap pakai untuk Prisma.
 *
 * @param query DTO query dari controller.
 */
export function getPaginationParams(query?: PaginationQueryDto): PaginationParams {
  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 10)));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
    sortBy: query?.sortBy,
    order: query?.order ?? SortOrder.DESC,
    search: query?.search?.trim() || undefined,
  };
}

/**
 * buildPaginationMeta()
 * Menyusun objek meta pagination dari total record + parameter aktif.
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const safeLimit = limit > 0 ? limit : 10;
  return {
    page,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

/**
 * paginate()
 * Helper generic untuk model Prisma yang punya method `findMany` & `count`.
 * Menjalankan keduanya secara paralel lalu mengembalikan { data, meta }.
 *
 * Contoh penggunaan di service:
 *   return paginate(this.prisma.user, { where, orderBy }, params);
 */
export async function paginate<T>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  },
  args: { where?: Record<string, unknown>; orderBy?: unknown; include?: unknown; select?: unknown },
  params: PaginationParams,
): Promise<PaginatedResult<T>> {
  const [data, total] = await Promise.all([
    model.findMany({
      ...args,
      skip: params.skip,
      take: params.take,
    }),
    model.count({ where: args.where }),
  ]);

  return {
    data,
    meta: buildPaginationMeta(total, params.page, params.limit),
  };
}
