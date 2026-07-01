/**
 * File: backend/src/modules/security/csp-report.controller.ts
 * Fungsi:
 *  - Endpoint publik `/csp-report` untuk menerima laporan CSP violation
 *    dari browser (report-uri / report-to).
 *  - Dipanggil oleh browser, bukan user manusia — TIDAK ada auth.
 *  - Dilindungi rate-limit yang sangat ketat agar tidak jadi vektor
 *    log-spam / DoS.
 *  - Body disimpan ke AuditLog dengan action `CSP_VIOLATION` supaya
 *    admin bisa audit pelanggaran CSP.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';

@ApiExcludeController()
@Controller({ path: 'csp-report', version: '1' })
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  constructor(private readonly audit: AuditLogsService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@Body() body: unknown, @Req() req: Request): Promise<void> {
    // Browser mengirim { "csp-report": {...} } (report-uri lawas) atau
    // array report (report-to modern). Kita simpan apa adanya.
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;

    this.logger.warn(`CSP violation from ${ip}: ${JSON.stringify(body).slice(0, 500)}`);

    // Sanitasi ukuran (max 4KB) sebelum simpan ke audit log
    const trimmed = JSON.stringify(body ?? {}).slice(0, 4000);
    await this.audit.write({
      userId: null,
      action: 'CSP_VIOLATION',
      module: 'SECURITY',
      description: 'Browser melaporkan pelanggaran Content-Security-Policy',
      ipAddress: ip,
      userAgent: ua,
      metadata: { raw: trimmed },
    });
  }
}
