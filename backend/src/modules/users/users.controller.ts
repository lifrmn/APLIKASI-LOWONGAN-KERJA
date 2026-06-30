/**
 * File: backend/src/modules/users/users.controller.ts
 * Fungsi:
 *  - Endpoint REST CRUD user + change role/status + reset password.
 *  - Hanya SUPER_ADMIN & ADMIN_DINAS yang boleh akses.
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Roles('SUPER_ADMIN', 'ADMIN_DINAS')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @ApiOperation({ summary: 'Daftar user (paginated, search by name/email/username/role)' })
  async list(@Query() query: PaginationQueryDto) {
    const { data, meta } = await this.service.list(query);
    return paginated(data, meta, 'Daftar user berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail user' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.service.findById(id);
    return success(data, 'Detail user berhasil diambil');
  }

  @Get(':id/login-history')
  @ApiOperation({ summary: 'Riwayat login user (paginated)' })
  async loginHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, meta } = await this.service.loginHistory(id, query);
    return paginated(data, meta, 'Riwayat login berhasil diambil');
  }

  @Post()
  @ApiOperation({ summary: 'Buat user baru' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.create(dto, actor, this.ctxOf(req));
    return success(data, 'User berhasil dibuat');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update profil user' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.update(id, dto, actor, this.ctxOf(req));
    return success(data, 'User berhasil diperbarui');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus user (soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.remove(id, actor, this.ctxOf(req));
    return success(null, 'User berhasil dihapus');
  }

  @Patch(':id/change-role')
  @ApiOperation({ summary: 'Ganti role user' })
  async changeRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.changeRole(id, dto, actor, this.ctxOf(req));
    return success(data, 'Role user berhasil diubah');
  }

  @Patch(':id/change-status')
  @ApiOperation({ summary: 'Ganti status user (aktif/nonaktif/banned)' })
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeUserStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.changeStatus(id, dto, actor, this.ctxOf(req));
    return success(data, 'Status user berhasil diubah');
  }

  @Patch(':id/reset-password')
  @ApiOperation({ summary: 'Reset password user (oleh admin)' })
  async resetPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.resetPassword(id, dto, actor, this.ctxOf(req));
    return success(null, 'Password user berhasil direset');
  }
}
