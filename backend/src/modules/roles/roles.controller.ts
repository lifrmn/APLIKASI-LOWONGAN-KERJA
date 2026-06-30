/**
 * File: backend/src/modules/roles/roles.controller.ts
 * Fungsi: Endpoint REST CRUD role + manage permission per role.
 *         Hanya SUPER_ADMIN & ADMIN_DINAS yang boleh akses (mutasi
 *         lebih sensitif dibatasi ke SUPER_ADMIN).
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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Roles('SUPER_ADMIN', 'ADMIN_DINAS')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly service: RolesService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @ApiOperation({ summary: 'Daftar role (paginated)' })
  async list(@Query() query: PaginationQueryDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar role berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail role + permissions' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.service.findById(id);
    return success(data, 'Detail role berhasil diambil');
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Buat role baru (SUPER_ADMIN)' })
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor.id, this.ctxOf(req));
    return success(data, 'Role berhasil dibuat');
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update role (SUPER_ADMIN)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor.id, this.ctxOf(req));
    return success(data, 'Role berhasil diperbarui');
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Hapus role (SUPER_ADMIN, soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor.id, this.ctxOf(req));
    return success(null, 'Role berhasil dihapus');
  }

  @Post(':id/permissions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign permission ke role (SUPER_ADMIN)' })
  async assign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.assignPermissions(
      id,
      dto.permissionIds,
      actor.id,
      this.ctxOf(req),
    );
    return success(data, 'Permission berhasil di-assign ke role');
  }

  @Delete(':id/permissions/:permissionId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Hapus permission dari role (SUPER_ADMIN)' })
  async unassign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('permissionId', new ParseUUIDPipe()) permissionId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.removePermission(
      id,
      permissionId,
      actor.id,
      this.ctxOf(req),
    );
    return success(data, 'Permission berhasil dihapus dari role');
  }
}
