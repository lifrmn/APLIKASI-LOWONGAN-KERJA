/**
 * File: backend/src/modules/chat/enums/message-type.enum.ts
 * Fungsi: Re-export enum MessageType dari Prisma.
 */

import { MessageType } from '@prisma/client';

export { MessageType };

export const MESSAGE_TYPES: ReadonlyArray<MessageType> = [
  MessageType.TEXT,
  MessageType.FILE,
  MessageType.IMAGE,
];
