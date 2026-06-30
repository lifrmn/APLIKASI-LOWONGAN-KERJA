/**
 * File: backend/src/modules/permissions/permissions.controller.ts
 * Fungsi:
 *  - Endpoint REST CRUD permission.
 *  - Semua endpoint butuh JWT (global guard) + role SUPER_ADMIN / ADMIN_DINAS.
 *  - SUPER_ADMIN otomatis bypass via RolesGuard.
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

import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Roles('SUPER_ADMIN', 'ADMIN_DINAS')
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @ApiOperation({ summary: 'Daftar permission (paginated)' })
  async list(@Query() query: PaginationQueryDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar permission berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail permission' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.service.findById(id);
    return success(data, 'Detail permission berhasil diambil');
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Buat permission baru (SUPER_ADMIN)' })
  async create(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor.id, this.ctxOf(req));
    return success(data, 'Permission berhasil dibuat');
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update permission (SUPER_ADMIN)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor.id, this.ctxOf(req));
    return success(data, 'Permission berhasil diperbarui');
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Hapus permission (SUPER_ADMIN, soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor.id, this.ctxOf(req));
    return success(null, 'Permission berhasil dihapus');
  }
}
