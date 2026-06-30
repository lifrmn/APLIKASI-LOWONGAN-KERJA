/**
 * File: backend/src/modules/files/files.controller.ts
 * Fungsi:
 *  - Endpoint REST FilesModule.
 *  - 7 endpoint upload khusus + 1 generic /files/upload + list/detail/
 *    download/update/delete + 1 endpoint public download.
 *  - Setiap upload memakai FileInterceptor + multer diskStorage
 *    dengan filter MIME/size sesuai kategori.
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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { FilterFileDto } from './dto/filter-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FileCategory } from './enums/file-category.enum';
import { FilesService } from './files.service';
import {
  multerOptionsForCategory,
  multerOptionsGeneric,
} from './utils/file-filter.util';

/**
 * Schema body untuk Swagger pada endpoint upload multipart.
 */
const SINGLE_FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('Files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly service: FilesService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private assertFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException('Field "file" wajib diisi');
  }

  // ============================================================
  //                          UPLOAD
  // ============================================================

  @Post('upload')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload file umum. Tentukan kategori via query ?category=<FileCategory>',
  })
  @ApiQuery({ name: 'category', enum: FileCategory, required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsGeneric()))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category: FileCategory | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: category ?? FileCategory.OTHER, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'File berhasil diupload');
  }

  @Post('upload-cv')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload CV (PDF/DOC/DOCX, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.CV)))
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.CV, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'CV berhasil diupload');
  }

  @Post('upload-certificate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload sertifikat (PDF/JPG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.CERTIFICATE)))
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.CERTIFICATE, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'Sertifikat berhasil diupload');
  }

  @Post('upload-portfolio')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload portofolio (PDF/JPG/PNG/ZIP, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.PORTFOLIO)))
  async uploadPortfolio(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.PORTFOLIO, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'Portofolio berhasil diupload');
  }

  @Post('upload-profile-photo')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload foto profil (JPG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.PROFILE_PHOTO)))
  async uploadProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.PROFILE_PHOTO, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'Foto profil berhasil diupload');
  }

  @Post('upload-company-logo')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload logo perusahaan (JPG/PNG, max 5MB, default PUBLIC)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.COMPANY_LOGO)))
  async uploadCompanyLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.COMPANY_LOGO, ownerId: actor.id, isPublic: true },
      this.ctxOf(req),
    );
    return success(data, 'Logo perusahaan berhasil diupload');
  }

  @Post('upload-company-document')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload dokumen perusahaan (PDF/JPG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', multerOptionsForCategory(FileCategory.COMPANY_DOCUMENT)),
  )
  async uploadCompanyDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.store(
      file,
      { category: FileCategory.COMPANY_DOCUMENT, ownerId: actor.id },
      this.ctxOf(req),
    );
    return success(data, 'Dokumen perusahaan berhasil diupload');
  }

  // ============================================================
  //                       LIST / DETAIL / MANAGE
  // ============================================================

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Daftar file (paginated). Non-admin hanya milik sendiri.' })
  async list(@Query() query: FilterFileDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.list(query, actor);
    return paginated(data, meta, 'Daftar file berhasil diambil');
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Detail metadata file' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail file berhasil diambil');
  }

  @Get(':id/download')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Download file (stream)' })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.service.findById(id, actor);
    const payload = this.service.download(file, 'attachment');
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    return payload.stream;
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Akses file public (mis. logo perusahaan)' })
  async findPublic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.service.findPublic(id);
    const payload = this.service.download(file, 'inline');
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${payload.filename}"`);
    return payload.stream;
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update metadata file (toggle isPublic)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor, this.ctxOf(req));
    return success(data, 'File berhasil diperbarui');
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Hapus file (soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'File berhasil dihapus');
  }
}
