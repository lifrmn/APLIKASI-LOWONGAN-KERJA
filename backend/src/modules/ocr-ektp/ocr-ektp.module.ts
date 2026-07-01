/**
 * File: backend/src/modules/ocr-ektp/ocr-ektp.module.ts
 * Fungsi:
 *  - Registrasi OcrEktpController, OcrEktpService, dan provider OCR
 *    (MockOcrProvider di MVP). Untuk beralih ke Tesseract/eksternal,
 *    cukup ganti binding OCR_PROVIDER di sini.
 *  - Bergantung pada FilesModule untuk menyimpan gambar e-KTP.
 */

import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';
import { OcrEktpController } from './ocr-ektp.controller';
import { OcrEktpService } from './ocr-ektp.service';
import { MockOcrProvider } from './providers/mock-ocr.provider';
import { OCR_PROVIDER } from './providers/ocr-provider.interface';

@Module({
  imports: [FilesModule],
  controllers: [OcrEktpController],
  providers: [
    OcrEktpService,
    MockOcrProvider,
    { provide: OCR_PROVIDER, useExisting: MockOcrProvider },
  ],
  exports: [OcrEktpService],
})
export class OcrEktpModule {}
