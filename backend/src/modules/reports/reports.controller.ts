/**
 * File: backend/src/modules/reports/reports.controller.ts
 * Fungsi:
 *  - Endpoint REST laporan: 7 endpoint JSON + 8 endpoint export
 *    (PDF/Excel untuk 4 entitas).
 *  - Endpoint export hanya boleh SUPER_ADMIN, ADMIN_DINAS, LEADER.
 *  - File dikirim via res.send(buffer) dengan header download.
 */

import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ExportPayload, ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- JSON REPORTS --------

  @Get('job-seekers')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Laporan pencari kerja (paginated + filter)' })
  async jobSeekers(@Query() query: ReportFilterDto) {
    const { data, meta } = await this.service.listJobSeekers(query);
    return paginated(data, meta, 'Laporan pencari kerja berhasil diambil');
  }

  @Get('companies')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Laporan perusahaan' })
  async companies(@Query() query: ReportFilterDto) {
    const { data, meta } = await this.service.listCompanies(query);
    return paginated(data, meta, 'Laporan perusahaan berhasil diambil');
  }

  @Get('jobs')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Laporan lowongan kerja' })
  async jobs(@Query() query: ReportFilterDto) {
    const { data, meta } = await this.service.listJobs(query);
    return paginated(data, meta, 'Laporan lowongan berhasil diambil');
  }

  @Get('applications')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Laporan lamaran kerja' })
  async applications(@Query() query: ReportFilterDto) {
    const { data, meta } = await this.service.listApplications(query);
    return paginated(data, meta, 'Laporan lamaran berhasil diambil');
  }

  @Get('interviews')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Laporan interview' })
  async interviews(@Query() query: ReportFilterDto) {
    const { data, meta } = await this.service.listInterviews(query);
    return paginated(data, meta, 'Laporan interview berhasil diambil');
  }

  @Get('regions')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Laporan jumlah pencari kerja & perusahaan per kecamatan/desa' })
  async regions() {
    const data = await this.service.regionsReport();
    return success(data, 'Laporan regional berhasil diambil');
  }

  @Get('skills')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Laporan skill pencari kerja & kebutuhan lowongan' })
  async skills() {
    const data = await this.service.skillsReport(20);
    return success(data, 'Laporan skill berhasil diambil');
  }

  // -------- EXPORT (PDF / EXCEL) --------

  @Get('export/job-seekers/:format')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Export pencari kerja ke PDF/Excel' })
  async exportJobSeekers(
    @Param('format') format: 'pdf' | 'excel',
    @Query() query: ReportFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fmt = this.parseFormat(format, res);
    if (!fmt) return;
    const payload = await this.service.exportJobSeekers(fmt, query, actor, this.ctxOf(req));
    this.sendDownload(res, payload);
  }

  @Get('export/companies/:format')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Export perusahaan ke PDF/Excel' })
  async exportCompanies(
    @Param('format') format: 'pdf' | 'excel',
    @Query() query: ReportFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fmt = this.parseFormat(format, res);
    if (!fmt) return;
    const payload = await this.service.exportCompanies(fmt, query, actor, this.ctxOf(req));
    this.sendDownload(res, payload);
  }

  @Get('export/jobs/:format')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Export lowongan ke PDF/Excel' })
  async exportJobs(
    @Param('format') format: 'pdf' | 'excel',
    @Query() query: ReportFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fmt = this.parseFormat(format, res);
    if (!fmt) return;
    const payload = await this.service.exportJobs(fmt, query, actor, this.ctxOf(req));
    this.sendDownload(res, payload);
  }

  @Get('export/applications/:format')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Export lamaran ke PDF/Excel' })
  async exportApplications(
    @Param('format') format: 'pdf' | 'excel',
    @Query() query: ReportFilterDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fmt = this.parseFormat(format, res);
    if (!fmt) return;
    const payload = await this.service.exportApplications(fmt, query, actor, this.ctxOf(req));
    this.sendDownload(res, payload);
  }

  // ============================================================
  //                          HELPERS
  // ============================================================

  private parseFormat(format: string, res: Response): 'pdf' | 'excel' | null {
    if (format !== 'pdf' && format !== 'excel') {
      res.status(400).json({
        success: false,
        message: 'Format harus pdf atau excel',
        error: { statusCode: 400, code: 'BAD_REQUEST', timestamp: new Date().toISOString() },
      });
      return null;
    }
    return format;
  }

  private sendDownload(res: Response, payload: ExportPayload): void {
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    res.setHeader('Content-Length', payload.buffer.length.toString());
    res.send(payload.buffer);
  }
}
