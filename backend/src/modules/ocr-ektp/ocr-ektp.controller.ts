/**
 * File: backend/src/modules/ocr-ektp/ocr-ektp.controller.ts
 * Fungsi:
 *  - Endpoint REST OCR e-KTP:
 *      * POST   /v1/ocr-ektp/submit      — JOB_SEEKER upload + OCR
 *      * GET    /v1/ocr-ektp/me          — hasil terakhir milik saya
 *      * GET    /v1/ocr-ektp             — list (admin)
 *      * GET    /v1/ocr-ektp/:id         — detail (owner/admin)
 *      * PATCH  /v1/ocr-ektp/:id/verify  — admin
 *      * PATCH  /v1/ocr-ektp/:id/reject  — admin
 *  - OCR e-KTP bersifat OPSIONAL; tidak menjadi syarat register.
 */

import {
  BadRequestException,
  Body,
  Controller,
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
import { RequestContext } from '../auth/auth.service';
import { FileCategory } from '../files/enums/file-category.enum';
import { multerOptionsForCategory } from '../files/utils/file-filter.util';
import { ListOcrQueryDto } from './dto/list-ocr.query.dto';
import { RejectOcrDto, VerifyOcrDto } from './dto/verify-ocr.dto';
import { OcrEktpService } from './ocr-ektp.service';

const SINGLE_FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('OCR e-KTP')
@ApiBearerAuth('access-token')
@Controller({ path: 'ocr-ektp', version: '1' })
export class OcrEktpController {
  constructor(private readonly service: OcrEktpService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private assertFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException('Field "file" wajib diisi (JPEG/PNG e-KTP)');
  }

  // ----- SUBMIT -----
  @Post('submit')
  @Roles('JOB_SEEKER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload gambar e-KTP + jalankan OCR (opsional, hasil PENDING)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SINGLE_FILE_BODY)
  @UseInterceptors(FileInterceptor('file', multerOptionsForCategory(FileCategory.E_KTP)))
  async submit(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    this.assertFile(file);
    const data = await this.service.submit(actor, file, this.ctxOf(req));
    return success(data, 'Hasil OCR e-KTP tersimpan, menunggu verifikasi admin');
  }

  // ----- ME -----
  @Get('me')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Hasil OCR e-KTP terakhir milik saya' })
  async findMine(@CurrentUser() actor: AuthUser) {
    const data = await this.service.findMine(actor);
    return success(data, 'Hasil OCR e-KTP terakhir berhasil diambil');
  }

  // ----- LIST -----
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Daftar hasil OCR e-KTP (admin)' })
  async list(
    @Query() query: ListOcrQueryDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const { data, meta } = await this.service.list(actor, query, this.ctxOf(req));
    return paginated(data, meta, 'Daftar OCR e-KTP berhasil diambil');
  }

  // ----- DETAIL -----
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'JOB_SEEKER')
  @ApiOperation({ summary: 'Detail hasil OCR e-KTP (owner atau admin)' })
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.findById(actor, id, this.ctxOf(req));
    return success(data, 'Detail OCR e-KTP berhasil diambil');
  }

  // ----- VERIFY -----
  @Patch(':id/verify')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Verifikasi hasil OCR e-KTP (admin)' })
  async verify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VerifyOcrDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.verify(actor, id, dto.note, this.ctxOf(req));
    return success(data, 'OCR e-KTP berhasil diverifikasi');
  }

  // ----- REJECT -----
  @Patch(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Tolak hasil OCR e-KTP (admin, wajib alasan)' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectOcrDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.reject(actor, id, dto.reason, this.ctxOf(req));
    return success(data, 'OCR e-KTP berhasil ditolak');
  }
}
