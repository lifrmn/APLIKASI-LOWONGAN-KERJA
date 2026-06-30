/**
 * File: backend/src/modules/jobs/jobs.controller.ts
 * Fungsi:
 *  - Endpoint REST lowongan kerja.
 *  - GET /jobs/active dibuka via @Public() agar pencari kerja yang
 *    belum login (atau aplikasi mobile listing) tetap bisa melihat.
 *  - Endpoint lain butuh JWT.
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { AddJobSkillDto } from './dto/add-job-skill.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { FilterJobDto } from './dto/filter-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly service: JobsService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- LIST --------

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Daftar lowongan (admin: semua; lainnya: aktif + filter)' })
  async list(@Query() query: FilterJobDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.list(query, actor);
    return paginated(data, meta, 'Daftar lowongan berhasil diambil');
  }

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Daftar lowongan aktif (PUBLIK)' })
  async listActive(@Query() query: FilterJobDto) {
    const { data, meta } = await this.service.listActive(query);
    return paginated(data, meta, 'Daftar lowongan aktif berhasil diambil');
  }

  @Get('my-company')
  @ApiBearerAuth('access-token')
  @Roles('COMPANY', 'HRD')
  @ApiOperation({ summary: 'Lowongan milik perusahaan akun login' })
  async listMyCompany(@Query() query: FilterJobDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.listMyCompany(query, actor);
    return paginated(data, meta, 'Lowongan perusahaan Anda berhasil diambil');
  }

  @Get('recommended')
  @ApiBearerAuth('access-token')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Rekomendasi lowongan berdasarkan skill pencari kerja' })
  async recommended(@Query() query: FilterJobDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.recommended(actor, query);
    return paginated(data, meta, 'Rekomendasi lowongan berhasil diambil');
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Detail lowongan' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthUser) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail lowongan berhasil diambil');
  }

  // -------- WRITE --------

  @Post()
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Buat lowongan baru (DRAFT)' })
  async create(
    @Body() dto: CreateJobDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor, this.ctxOf(req));
    return success(data, 'Lowongan berhasil dibuat sebagai DRAFT');
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Update lowongan' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor, this.ctxOf(req));
    return success(data, 'Lowongan berhasil diperbarui');
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Hapus lowongan (soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'Lowongan berhasil dihapus');
  }

  @Patch(':id/publish')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Publish lowongan (perusahaan harus VERIFIED)' })
  async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.publish(id, actor, this.ctxOf(req));
    return success(data, 'Lowongan berhasil di-publish');
  }

  @Patch(':id/close')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Tutup lowongan' })
  async close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.close(id, actor, this.ctxOf(req));
    return success(data, 'Lowongan berhasil ditutup');
  }

  @Patch(':id/draft')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Kembalikan lowongan ke DRAFT' })
  async draft(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.draft(id, actor, this.ctxOf(req));
    return success(data, 'Lowongan dikembalikan ke DRAFT');
  }

  // -------- SKILLS --------

  @Post(':id/skills')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Tambah skill yang dibutuhkan pada lowongan' })
  async addSkill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddJobSkillDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addSkill(id, dto, actor, this.ctxOf(req));
    return success(data, 'Skill berhasil ditambahkan pada lowongan');
  }

  @Delete(':id/skills/:skillId')
  @ApiBearerAuth('access-token')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Hapus skill dari lowongan' })
  async removeSkill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('skillId', new ParseUUIDPipe()) skillId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeSkill(id, skillId, actor, this.ctxOf(req));
    return success(null, 'Skill berhasil dihapus dari lowongan');
  }
}
