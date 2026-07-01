/**
 * File: backend/src/common/filters/all-exceptions.filter.ts
 * Fungsi:
 *  - Global exception filter yang menangkap semua jenis exception
 *    (HttpException, Prisma error, error tak terduga) dan menormalkan
 *    response ke format:
 *      { success: false, message, error: { statusCode, code, details, path, timestamp } }
 *  - Mencegah informasi sensitif (stack trace) bocor ke client di
 *    production, tetapi tetap mencatatnya melalui Logger.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import { error as toErrorResponse } from '../utils/api-response.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, code, details } = this.normalize(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method} ${request.url}] ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.method} ${request.url}] ${message}`);
    }

    // Di produksi: JANGAN kirim `details` untuk 5xx (cegah stack/meta bocor).
    // Untuk 4xx tetap dikirim (validation errors berguna bagi klien).
    const safeDetails = this.isProd && statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
      ? undefined
      : details;

    response
      .status(statusCode)
      .json(toErrorResponse(message, statusCode, code, request.url, safeDetails));
  }

  /**
   * normalize()
   * Mengubah berbagai jenis exception menjadi bentuk seragam
   * { statusCode, message, code, details }.
   */
  private normalize(exception: unknown): {
    statusCode: number;
    message: string;
    code: string;
    details?: unknown;
  } {
    // --- 1. HttpException dari Nest (BadRequest, Unauthorized, dll) ---
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return {
          statusCode,
          message: res,
          code: this.statusToCode(statusCode),
        };
      }

      const obj = res as Record<string, unknown>;
      const message =
        (Array.isArray(obj.message) ? obj.message.join(', ') : (obj.message as string)) ||
        exception.message ||
        'Terjadi kesalahan';

      return {
        statusCode,
        message,
        code: (obj.error as string) || this.statusToCode(statusCode),
        details: obj.message ?? obj,
      };
    }

    // --- 2. Prisma known request error ---
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaKnown(exception);
    }

    // --- 3. Prisma validation error ---
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Data input tidak valid untuk database',
        code: 'PRISMA_VALIDATION_ERROR',
      };
    }

    // --- 4. SyntaxError body JSON rusak (dari express.json parser) ---
    if (exception instanceof SyntaxError && 'body' in (exception as unknown as Record<string, unknown>)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Request body bukan JSON valid',
        code: 'INVALID_JSON',
      };
    }

    // --- 5. Error JS biasa / unknown ---
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          process.env.NODE_ENV === 'production'
            ? 'Terjadi kesalahan pada server'
            : exception.message,
        code: 'INTERNAL_SERVER_ERROR',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kesalahan tak terduga',
      code: 'UNKNOWN_ERROR',
    };
  }

  /**
   * handlePrismaKnown()
   * Memetakan kode error Prisma yang umum ke HTTP status & pesan ramah.
   * Daftar kode: https://www.prisma.io/docs/reference/api-reference/error-reference
   */
  private handlePrismaKnown(err: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    code: string;
    details?: unknown;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Data sudah ada (unique constraint dilanggar)',
          code: 'UNIQUE_CONSTRAINT',
          details: err.meta,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Data tidak ditemukan',
          code: 'NOT_FOUND',
          details: err.meta,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key tidak valid',
          code: 'FOREIGN_KEY_VIOLATION',
          details: err.meta,
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Kesalahan database',
          code: `PRISMA_${err.code}`,
          details: err.meta,
        };
    }
  }

  /**
   * statusToCode()
   * Mengubah HTTP status code menjadi string code yang konsisten.
   */
  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? `HTTP_${status}`;
  }
}
