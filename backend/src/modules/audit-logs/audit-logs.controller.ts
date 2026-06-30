/**
 * File: backend/src/modules/audit-logs/audit-logs.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk membaca / export / menghapus audit log.
 *  - Memakai AuditLogsService (global, sudah disediakan
 *    DatabaseModule). Tidak perlu provider tambahan.
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import { paginated, success } from '../../common/utils/api-response.util';
import { FilterAuditLogDto } from './dto/filter-audit-log.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  private ctxOf(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- READ --------

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Daftar audit log (paginated + filter)' })
  async list(@Query() query: FilterAuditLogDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar audit log berhasil diambil');
  }

  @Get('export/excel')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Export audit log ke Excel' })
  async exportExcel(
    @Query() query: FilterAuditLogDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const payload = await this.service.exportExcel(query);
    await this.service.write({
      userId: actor.id,
      action: 'EXPORT',
      module: 'AUDIT_LOGS',
      description: 'Export audit log ke Excel',
      ipAddress: this.ctxOf(req).ipAddress,
      userAgent: this.ctxOf(req).userAgent,
    });
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    res.send(payload.buffer);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Detail audit log' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.service.findById(id);
    return success(data, 'Detail audit log berhasil diambil');
  }

  // -------- DELETE --------

  @Delete('clear/old')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Bersihkan audit log lebih lama dari N hari (SUPER_ADMIN, min 30 hari)',
  })
  @ApiQuery({ name: 'days', required: false, example: 365 })
  async clearOld(
    @Query('days') days: string | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.clearOld(Number(days ?? 365), actor, this.ctxOf(req));
    return success(data, `Audit log lama berhasil dibersihkan (${data.deleted} baris)`);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Hapus 1 audit log (SUPER_ADMIN)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.deleteOne(id, actor, this.ctxOf(req));
    return success(null, 'Audit log berhasil dihapus');
  }
}
