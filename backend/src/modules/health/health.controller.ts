/**
 * File: backend/src/modules/health/health.controller.ts
 * Fungsi:
 *  - Endpoint publik `/health` untuk liveness/readiness probe (Docker,
 *    Kubernetes, Uptime Monitor). Tidak butuh JWT.
 *  - `GET /api/v1/health`     — liveness (proses hidup)
 *  - `GET /api/v1/health/ready` — readiness (DB juga OK)
 */

import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiExcludeController()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  private readonly startedAt = new Date();

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
      time: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async readiness() {
    try {
      // Cek konektivitas DB dengan query paling murah
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'down',
      });
    }
  }
}
