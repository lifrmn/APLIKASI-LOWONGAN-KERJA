/**
 * File: backend/src/modules/applications/applications.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk lamaran kerja.
 *  - Semua butuh JWT (guard global). Role dibatasi lewat @Roles
 *    di tiap endpoint. Ownership detail dicek di service.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { FilterApplicationDto } from './dto/filter-application.dto';
import { UpdateApplicationNoteDto } from './dto/update-application-note.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@Controller({ path: 'applications', version: '1' })
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- LIST --------

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Daftar semua lamaran (admin, paginated + filter)' })
  async list(@Query() query: FilterApplicationDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar lamaran berhasil diambil');
  }

  @Get('my-applications')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Riwayat lamaran milik pencari kerja login' })
  async myApplications(
    @Query() query: FilterApplicationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const { data, meta } = await this.service.myApplications(actor, query);
    return paginated(data, meta, 'Riwayat lamaran berhasil diambil');
  }

  @Get('job/:jobId')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Daftar pelamar pada satu lowongan (admin/perusahaan)' })
  async listByJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Query() query: FilterApplicationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const { data, meta } = await this.service.listByJob(jobId, query, actor);
    return paginated(data, meta, 'Daftar pelamar berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail lamaran' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail lamaran berhasil diambil');
  }

  @Get(':id/status-histories')
  @ApiOperation({ summary: 'Riwayat perubahan status lamaran' })
  async statusHistories(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.statusHistories(id, actor);
    return success(data, 'Riwayat status lamaran berhasil diambil');
  }

  // -------- WRITE --------

  @Post()
  @Roles('JOB_SEEKER', 'SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Buat lamaran baru (JOB_SEEKER, atau admin atas nama pelamar)' })
  async create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor, this.ctxOf(req));
    return success(data, 'Lamaran berhasil dibuat');
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Update status lamaran (catat history + notifikasi)' })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateStatus(id, dto, actor, this.ctxOf(req));
    return success(data, 'Status lamaran berhasil diperbarui');
  }

  @Patch(':id/note')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Update catatan reviewer pada lamaran' })
  async updateNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateApplicationNoteDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateNote(id, dto, actor, this.ctxOf(req));
    return success(data, 'Catatan lamaran berhasil diperbarui');
  }

  @Patch(':id/cancel')
  @Roles('JOB_SEEKER', 'SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Batalkan lamaran (pelamar, hanya bila status APPLIED)' })
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.cancel(id, actor, this.ctxOf(req));
    return success(data, 'Lamaran berhasil dibatalkan');
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Hapus lamaran (admin, soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'Lamaran berhasil dihapus');
  }
}
