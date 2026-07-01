/**
 * File: backend/src/modules/ocr-ektp/ocr-ektp.module.ts
 * Fungsi:
 *  - Registrasi OcrEktpController + service + provider OCR.
 *  - Pilihan provider ditentukan env `OCR_PROVIDER`:
 *      * "mock"      (default) → MockOcrProvider (data dummy)
 *      * "tesseract"           → TesseractOcrProvider (tesseract.js)
 *  - Bergantung pada FilesModule untuk menyimpan gambar e-KTP.
 */

import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';
import { OcrEktpController } from './ocr-ektp.controller';
import { OcrEktpService } from './ocr-ektp.service';
import { MockOcrProvider } from './providers/mock-ocr.provider';
import { OCR_PROVIDER } from './providers/ocr-provider.interface';
import { TesseractOcrProvider } from './providers/tesseract-ocr.provider';

const providerToken = {
  provide: OCR_PROVIDER,
  useFactory: (mock: MockOcrProvider, tess: TesseractOcrProvider) =>
    (process.env.OCR_PROVIDER || 'mock').toLowerCase() === 'tesseract' ? tess : mock,
  inject: [MockOcrProvider, TesseractOcrProvider],
};

@Module({
  imports: [FilesModule],
  controllers: [OcrEktpController],
  providers: [OcrEktpService, MockOcrProvider, TesseractOcrProvider, providerToken],
  exports: [OcrEktpService],
})
export class OcrEktpModule {}
