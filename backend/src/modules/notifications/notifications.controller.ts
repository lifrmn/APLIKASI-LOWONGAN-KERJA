/**
 * File: backend/src/modules/notifications/notifications.controller.ts
 * Fungsi:
 *  - Endpoint REST notifikasi:
 *      GET /notifications, /unread-count, /:id
 *      POST /notifications, /bulk, /role, /announcement
 *      PATCH /:id/read, /read-all
 *      DELETE /:id
 *  - Semua endpoint butuh JWT (global guard). Otorisasi role/owner
 *    dilakukan via @Roles + cek di service.
 */

import {
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateBulkNotificationDto } from './dto/create-bulk-notification.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateRoleNotificationDto } from './dto/create-role-notification.dto';
import { FilterNotificationDto } from './dto/filter-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- READ --------

  @Get()
  @ApiOperation({ summary: 'Daftar notifikasi milik user login (paginated + filter)' })
  async list(@Query() query: FilterNotificationDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.listForUser(actor, query);
    return paginated(data, meta, 'Daftar notifikasi berhasil diambil');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Jumlah notifikasi belum dibaca milik user login' })
  async unreadCount(@CurrentUser() actor: AuthUser) {
    const data = await this.service.unreadCount(actor);
    return success(data, 'Jumlah notifikasi belum dibaca berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail notifikasi' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.findById(id, actor);
    return success(data, 'Detail notifikasi berhasil diambil');
  }

  // -------- CREATE --------

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Kirim notifikasi ke 1 user (admin)' })
  async create(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createForUser(dto, actor, this.ctxOf(req));
    return success(data, 'Notifikasi berhasil dikirim');
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Kirim notifikasi ke banyak user (admin)' })
  async createBulk(
    @Body() dto: CreateBulkNotificationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createBulk(dto, actor, this.ctxOf(req));
    return success(data, 'Notifikasi bulk berhasil dikirim');
  }

  @Post('role')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Kirim notifikasi ke semua user dengan role tertentu (admin)' })
  async createRole(
    @Body() dto: CreateRoleNotificationDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createForRole(dto, actor, this.ctxOf(req));
    return success(data, 'Notifikasi role berhasil dikirim');
  }

  @Post('announcement')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Kirim pengumuman global / per role (admin)' })
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createAnnouncement(dto, actor, this.ctxOf(req));
    return success(data, 'Pengumuman berhasil dikirim');
  }

  // -------- READ STATE --------

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai 1 notifikasi sebagai dibaca' })
  async read(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.markRead(id, actor);
    return success(data, 'Notifikasi ditandai sebagai dibaca');
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai semua notifikasi user login sebagai dibaca' })
  async readAll(@CurrentUser() actor: AuthUser) {
    const data = await this.service.markAllRead(actor);
    return success(data, 'Semua notifikasi ditandai sebagai dibaca');
  }

  // -------- DELETE --------

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus notifikasi (pemilik atau admin, soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'Notifikasi berhasil dihapus');
  }
}
