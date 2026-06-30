/**
 * File: backend/src/modules/chat/dto/filter-message.dto.ts
 * Fungsi: Query DTO GET /chats/:id/messages — pagination saja
 *         (urut terbaru → lama).
 */

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FilterMessageDto extends PaginationQueryDto {}
