/**
 * File: backend/src/modules/companies/companies.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk perusahaan: CRUD, verify/reject, status,
 *    upload logo & legal document, manajemen HRD.
 *  - Otorisasi role di-decorate via @Roles; ownership detil dicek
 *    di service.
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
import { CompaniesService } from './companies.service';
import { AddHrdDto } from './dto/add-hrd.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies.query.dto';
import { RejectCompanyDto } from './dto/reject-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { VerifyCompanyDto } from './dto/verify-company.dto';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- READ --------

  @Get()
  @ApiOperation({ summary: 'Daftar perusahaan (paginated + filter)' })
  async list(@Query() query: ListCompaniesQueryDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar perusahaan berhasil diambil');
  }

  @Get('me')
  @Roles('COMPANY', 'HRD')
  @ApiOperation({ summary: 'Profil perusahaan milik akun login (COMPANY/HRD)' })
  async me(@CurrentUser() actor: AuthUser) {
    const data = await this.service.findMe(actor);
    return success(data, 'Profil perusahaan saya berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail perusahaan' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthUser) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail perusahaan berhasil diambil');
  }

  // -------- WRITE --------

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @ApiOperation({ summary: 'Buat profil perusahaan' })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor, this.ctxOf(req));
    return success(data, 'Profil perusahaan berhasil dibuat');
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @ApiOperation({ summary: 'Update profil perusahaan' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor, this.ctxOf(req));
    return success(data, 'Profil perusahaan berhasil diperbarui');
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Hapus perusahaan (soft delete, admin)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'Perusahaan berhasil dihapus');
  }

  @Patch(':id/verify')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Verifikasi perusahaan (admin)' })
  async verify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VerifyCompanyDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.verify(id, dto, actor, this.ctxOf(req));
    return success(data, 'Perusahaan berhasil diverifikasi');
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Tolak verifikasi perusahaan (admin)' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectCompanyDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.reject(id, dto, actor, this.ctxOf(req));
    return success(data, 'Verifikasi perusahaan ditolak');
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @ApiOperation({ summary: 'Aktif/nonaktifkan perusahaan' })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.updateStatus(id, dto, actor, this.ctxOf(req));
    return success(data, 'Status perusahaan berhasil diubah');
  }

  // -------- FILE UPLOAD --------

  @Post(':id/upload-logo')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload logo perusahaan (JPG/JPEG/PNG, max 5MB)' })
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
      multerOptions({
        subdir: 'company-logos',
        allowedMime: ALLOWED_MIME.COMPANY_LOGO,
        maxBytes: MB(5),
      }),
    ),
  )
  async uploadLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('File logo wajib diisi');
    const data = await this.service.uploadLogo(id, file, actor, this.ctxOf(req));
    return success(data, 'Logo perusahaan berhasil diupload');
  }

  @Post(':id/upload-legal-document')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload dokumen legalitas (PDF/JPG/JPEG/PNG, max 5MB)' })
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
      multerOptions({
        subdir: 'company-docs',
        allowedMime: ALLOWED_MIME.COMPANY_DOC,
        maxBytes: MB(5),
      }),
    ),
  )
  async uploadLegalDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('File dokumen legalitas wajib diisi');
    const data = await this.service.uploadLegalDocument(id, file, actor, this.ctxOf(req));
    return success(data, 'Dokumen legalitas berhasil diupload');
  }

  // -------- HRD --------

  @Get(':id/hrd')
  @ApiOperation({ summary: 'Daftar HRD pada perusahaan' })
  async listHrd(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.listHrd(id, actor);
    return success(data, 'Daftar HRD berhasil diambil');
  }

  @Post(':id/hrd')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @ApiOperation({ summary: 'Tambah HRD ke perusahaan' })
  async addHrd(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddHrdDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.addHrd(id, dto, actor, this.ctxOf(req));
    return success(data, 'HRD berhasil ditambahkan');
  }

  @Delete(':id/hrd/:userId')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'COMPANY')
  @ApiOperation({ summary: 'Hapus HRD dari perusahaan' })
  async removeHrd(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeHrd(id, userId, actor, this.ctxOf(req));
    return success(null, 'HRD berhasil dihapus dari perusahaan');
  }
}
