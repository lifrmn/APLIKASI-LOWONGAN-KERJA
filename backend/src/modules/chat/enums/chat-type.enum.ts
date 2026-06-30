/**
 * File: backend/src/modules/chat/enums/chat-type.enum.ts
 * Fungsi: Re-export enum ChatType dari Prisma.
 */

import { ChatType } from '@prisma/client';

export { ChatType };

export const CHAT_TYPES: ReadonlyArray<ChatType> = [
  ChatType.PRIVATE,
  ChatType.APPLICATION,
  ChatType.JOB,
  ChatType.SUPPORT,
];
