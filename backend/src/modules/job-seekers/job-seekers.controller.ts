/**
 * File: backend/src/modules/job-seekers/job-seekers.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk profil pencari kerja & sub-resource.
 *  - Memakai JwtAuthGuard global. @Roles dipakai untuk membatasi
 *    siapa yang boleh akses endpoint sensitif (delete, status).
 *  - Owner/admin check dilakukan di service.
 *  - Upload file pakai Multer disk storage dengan filter MIME & size.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { ALLOWED_MIME, MB, multerOptions } from '../../common/utils/upload.util';
import { RequestContext } from '../auth/auth.service';
import { AddSkillDto } from './dto/add-skill.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { CreateJobSeekerDto } from './dto/create-job-seeker.dto';
import { ListJobSeekersQueryDto } from './dto/list-job-seekers.query.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { UpdateJobSeekerStatusDto } from './dto/update-job-seeker-status.dto';
import { UpdateJobSeekerDto } from './dto/update-job-seeker.dto';
import { JobSeekersService } from './job-seekers.service';

@ApiTags('Job Seekers')
@ApiBearerAuth('access-token')
@Controller({ path: 'job-seekers', version: '1' })
export class JobSeekersController {
  constructor(private readonly service: JobSeekersService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- READ --------

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA', 'COMPANY', 'HRD')
  @ApiOperation({ summary: 'Daftar pencari kerja (paginated + filter)' })
  async list(@Query() query: ListJobSeekersQueryDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar pencari kerja berhasil diambil');
  }

  @Get('me')
  @ApiOperation({ summary: 'Profil pencari kerja milik user yang login' })
  async me(@CurrentUser() actor: AuthUser) {
    const data = await this.service.findMe(actor.id);
    return success(data, 'Profil saya berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail profil pencari kerja' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthUser) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail profil berhasil diambil');
  }

  // -------- WRITE --------

  @Post()
  @ApiOperation({ summary: 'Buat profil pencari kerja' })
  async create(
    @Body() dto: CreateJobSeekerDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor, this.ctxOf(req));
    return success(data, 'Profil pencari kerja berhasil dibuat');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update profil pencari kerja' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateJobSeekerDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor, this.ctxOf(req));
    return success(data, 'Profil berhasil diperbarui');
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ubah workStatus pencari kerja' })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateJobSeekerStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateStatus(id, dto, actor, this.ctxOf(req));
    return success(data, 'Status pencari kerja berhasil diubah');
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Hapus profil pencari kerja (soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'Profil pencari kerja berhasil dihapus');
  }

  // -------- EDUCATION --------

  @Post(':id/education')
  @ApiOperation({ summary: 'Tambah riwayat pendidikan' })
  async addEducation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateEducationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addEducation(id, dto, actor, this.ctxOf(req));
    return success(data, 'Riwayat pendidikan berhasil ditambahkan');
  }

  @Patch(':id/education/:educationId')
  @ApiOperation({ summary: 'Update riwayat pendidikan' })
  async updateEducation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Body() dto: UpdateEducationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateEducation(id, educationId, dto, actor, this.ctxOf(req));
    return success(data, 'Riwayat pendidikan berhasil diperbarui');
  }

  @Delete(':id/education/:educationId')
  @ApiOperation({ summary: 'Hapus riwayat pendidikan' })
  async removeEducation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeEducation(id, educationId, actor, this.ctxOf(req));
    return success(null, 'Riwayat pendidikan berhasil dihapus');
  }

  // -------- EXPERIENCE --------

  @Post(':id/experiences')
  @ApiOperation({ summary: 'Tambah pengalaman kerja' })
  async addExperience(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateExperienceDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addExperience(id, dto, actor, this.ctxOf(req));
    return success(data, 'Pengalaman kerja berhasil ditambahkan');
  }

  @Patch(':id/experiences/:experienceId')
  @ApiOperation({ summary: 'Update pengalaman kerja' })
  async updateExperience(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('experienceId', new ParseUUIDPipe()) experienceId: string,
    @Body() dto: UpdateExperienceDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateExperience(id, experienceId, dto, actor, this.ctxOf(req));
    return success(data, 'Pengalaman kerja berhasil diperbarui');
  }

  @Delete(':id/experiences/:experienceId')
  @ApiOperation({ summary: 'Hapus pengalaman kerja' })
  async removeExperience(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('experienceId', new ParseUUIDPipe()) experienceId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeExperience(id, experienceId, actor, this.ctxOf(req));
    return success(null, 'Pengalaman kerja berhasil dihapus');
  }

  // -------- SKILLS --------

  @Post(':id/skills')
  @ApiOperation({ summary: 'Tambah skill ke profil' })
  async addSkill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddSkillDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addSkill(id, dto, actor, this.ctxOf(req));
    return success(data, 'Skill berhasil ditambahkan');
  }

  @Delete(':id/skills/:skillId')
  @ApiOperation({ summary: 'Hapus skill dari profil' })
  async removeSkill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('skillId', new ParseUUIDPipe()) skillId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeSkill(id, skillId, actor, this.ctxOf(req));
    return success(null, 'Skill berhasil dihapus dari profil');
  }

  // -------- FILE UPLOAD --------

  @Post(':id/upload-cv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload CV (PDF/DOC/DOCX, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor(
      'file',
      multerOptions({ subdir: 'cv', allowedMime: ALLOWED_MIME.CV, maxBytes: MB(5) }),
    ),
  )
  async uploadCv(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) {
      // FileInterceptor tidak otomatis wajib — validasi manual.
      throw new BadRequestException('File CV wajib diisi');
    }
    const data = await this.service.uploadCv(id, file, actor, this.ctxOf(req));
    return success(data, 'CV berhasil diupload');
  }

  @Post(':id/upload-certificate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload sertifikat (PDF/JPG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        issuer: { type: 'string' },
        issueDate: { type: 'string', format: 'date' },
        expiryDate: { type: 'string', format: 'date' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor(
      'file',
      multerOptions({
        subdir: 'certificates',
        allowedMime: ALLOWED_MIME.CERTIFICATE,
        maxBytes: MB(5),
      }),
    ),
  )
  async uploadCertificate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: { name?: string; issuer?: string; issueDate?: string; expiryDate?: string },
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('File sertifikat wajib diisi');
    }
    const data = await this.service.uploadCertificate(id, file, meta, actor, this.ctxOf(req));
    return success(data, 'Sertifikat berhasil diupload');
  }

  @Post(':id/upload-portfolio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload portofolio (PDF/JPG/PNG/ZIP, file opsional bila ada link)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string' },
        link: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor(
      'file',
      multerOptions({
        subdir: 'portfolios',
        allowedMime: ALLOWED_MIME.PORTFOLIO,
        maxBytes: MB(10),
      }),
    ),
  )
  async uploadPortfolio(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() meta: { title?: string; description?: string; link?: string },
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.uploadPortfolio(id, file, meta, actor, this.ctxOf(req));
    return success(data, 'Portofolio berhasil ditambahkan');
  }
}
