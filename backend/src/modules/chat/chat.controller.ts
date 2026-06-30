/**
 * File: backend/src/modules/chat/chat.controller.ts
 * Fungsi:
 *  - Endpoint REST chat & message.
 *  - Setelah mutasi sukses (sendMessage / markRead / removeChat /
 *    removeMessage), controller juga memanggil ChatGateway untuk
 *    broadcast event ke peserta yang sedang online.
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
import { paginated, success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { FilterChatDto } from './dto/filter-chat.dto';
import { FilterMessageDto } from './dto/filter-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller({ path: 'chats', version: '1' })
export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // -------- CHATS --------

  @Get()
  @ApiOperation({ summary: 'Daftar chat yang diikuti user login (paginated)' })
  async list(@Query() query: FilterChatDto, @CurrentUser() actor: AuthUser) {
    const { data, meta } = await this.service.listChats(actor, query);
    return paginated(data, meta, 'Daftar chat berhasil diambil');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Total pesan belum dibaca user login' })
  async unreadCount(@CurrentUser() actor: AuthUser) {
    const data = await this.service.unreadCount(actor);
    return success(data, 'Jumlah pesan belum dibaca berhasil diambil');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail chat' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const data = await this.service.findChat(id, actor);
    return success(data, 'Detail chat berhasil diambil');
  }

  @Post()
  @ApiOperation({ summary: 'Buat chat baru' })
  async create(
    @Body() dto: CreateChatDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.service.createChat(dto, actor, this.ctxOf(req));
    return success(data, 'Chat berhasil dibuat');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus chat (soft delete, pembuat/admin)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeChat(id, actor, this.ctxOf(req));
    this.gateway.emitChatUpdated(id, { deleted: true });
    return success(null, 'Chat berhasil dihapus');
  }

  // -------- MESSAGES --------

  @Get(':id/messages')
  @ApiOperation({ summary: 'Daftar pesan dalam chat (paginated, terbaru dulu)' })
  async messages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: FilterMessageDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const { data, meta } = await this.service.listMessages(id, actor, query);
    return paginated(data, meta, 'Daftar pesan berhasil diambil');
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kirim pesan ke chat (REST)' })
  async sendMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const message = await this.service.sendMessage(id, actor, dto);
    this.gateway.emitNewMessage(id, message);
    return success(message, 'Pesan berhasil dikirim');
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai chat sebagai sudah dibaca oleh user login' })
  async readChat(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const payload = await this.service.markRead(id, actor);
    this.gateway.emitMessageRead(id, payload);
    return success(payload, 'Chat ditandai sebagai dibaca');
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Hapus pesan (soft delete, pengirim/admin)' })
  async removeMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    await this.service.removeMessage(id, messageId, actor, this.ctxOf(req));
    this.gateway.emitChatUpdated(id, { messageDeleted: messageId });
    return success(null, 'Pesan berhasil dihapus');
  }
}
