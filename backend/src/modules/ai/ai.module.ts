/**
 * File: backend/src/modules/ai/ai.module.ts
 * Fungsi:
 *  - Mendaftarkan AiController, AiService, dan provider rule-based
 *    sebagai implementasi AI_PROVIDER. Untuk ganti ke ExternalAi
 *    di masa depan, cukup ubah binding token AI_PROVIDER di sini.
 */

import { Module } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { RuleBasedAiProvider } from './providers/rule-based-ai.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    RuleBasedAiProvider,
    { provide: AI_PROVIDER, useExisting: RuleBasedAiProvider },
  ],
  exports: [AiService],
})
export class AiModule {}
