/**
 * File: backend/src/modules/ocr-ektp/providers/tesseract-ocr.provider.ts
 * Fungsi:
 *  - Implementasi OcrProvider berbasis Tesseract.js (Bahasa Indonesia).
 *  - Membaca gambar dari disk lalu mem-parse field e-KTP dari
 *    hasil OCR rawText menggunakan regex/keyword.
 *
 * Prasyarat runtime:
 *   npm install tesseract.js
 *   Model tessdata `ind.traineddata` akan diunduh otomatis oleh
 *   tesseract.js pada eksekusi pertama (butuh koneksi internet).
 *   Untuk offline, letakkan file di `./tessdata/ind.traineddata` dan
 *   set env TESSDATA_PATH.
 *
 * Catatan:
 *  - OCR e-KTP realtime akurasinya bervariasi; hasil TETAP harus
 *    diverifikasi admin (status default PENDING).
 *  - Untuk MVP, provider tetap berbasis best-effort — bila Tesseract
 *    gagal (mis. package belum di-install), fallback ke null values
 *    (bukan crash).
 */

import { Injectable, Logger } from '@nestjs/common';

import { OcrEktpExtraction, OcrProvider } from './ocr-provider.interface';

@Injectable()
export class TesseractOcrProvider implements OcrProvider {
  private readonly logger = new Logger(TesseractOcrProvider.name);

  async extract(fileAbsolutePath: string, fileId: string): Promise<OcrEktpExtraction> {
    let rawText = '';
    let confidence: number | null = null;

    try {
      // Lazy import via string variable supaya package opsional
      // (tidak wajib terpasang saat compile).
      const modName = 'tesseract.js';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tesseract: any = await import(/* webpackIgnore: true */ modName).catch(() => null);
      if (!tesseract) {
        this.logger.warn('tesseract.js belum di-install, fallback ke null values');
        return this.empty();
      }

      const lang = 'ind';
      const langPath = process.env.TESSDATA_PATH || undefined;

      const { data } = await tesseract.recognize(fileAbsolutePath, lang, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        langPath,
        logger: (m: any) => {
          if (m?.status === 'recognizing text' && (m.progress ?? 0) === 1) {
            this.logger.debug(`OCR done fileId=${fileId}`);
          }
        },
      } as never);

      rawText = data.text ?? '';
      confidence = typeof data.confidence === 'number' ? data.confidence / 100 : null;
    } catch (e) {
      this.logger.error(`Tesseract error: ${(e as Error).message}`);
      return this.empty();
    }

    return this.parse(rawText, confidence);
  }

  private empty(): OcrEktpExtraction {
    return {
      nik: null, fullName: null, birthPlace: null, birthDate: null, gender: null,
      address: null, rtRw: null, village: null, district: null, religion: null,
      maritalStatus: null, occupation: null, nationality: null, rawText: null,
      confidence: null,
    };
  }

  /**
   * parse()
   * Ekstrak field e-KTP dari rawText Tesseract.
   * Regex/keyword yang dipakai sudah diuji terhadap KTP standar
   * Indonesia (label: NIK, Nama, Tempat/Tgl Lahir, Jenis Kelamin,
   * Alamat, RT/RW, Kel/Desa, Kecamatan, Agama, Status Perkawinan,
   * Pekerjaan, Kewarganegaraan).
   */
  private parse(rawText: string, confidence: number | null): OcrEktpExtraction {
    const t = rawText.replace(/\r/g, '').split('\n').map((s) => s.trim()).filter(Boolean).join('\n');
    const grab = (re: RegExp): string | null => {
      const m = t.match(re);
      return m ? m[1].trim() : null;
    };

    const nik = grab(/NIK\s*[:.]?\s*([0-9OIlL]{16})/i)?.replace(/[OIlL]/g, (c) =>
      c === 'O' ? '0' : '1',
    ) ?? null;

    const fullName = grab(/Nama\s*[:.]?\s*([A-Z .'-]+)/);
    // Tempat/Tgl Lahir: "MAMUJU, 01-01-1990"
    const ttl = grab(/Tempat\/Tgl\s*Lahir\s*[:.]?\s*([A-Z ,.\-0-9\/]+)/i);
    let birthPlace: string | null = null;
    let birthDate: Date | null = null;
    if (ttl) {
      const parts = ttl.split(',');
      birthPlace = parts[0]?.trim() ?? null;
      const dateStr = parts[1]?.trim();
      if (dateStr) {
        const m = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
        if (m) {
          const y = m[3].length === 2 ? 1900 + parseInt(m[3], 10) : parseInt(m[3], 10);
          birthDate = new Date(Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
        }
      }
    }

    const genderRaw = grab(/Jenis\s*Kelamin\s*[:.]?\s*(LAKI|PEREMPUAN|L|P)/i);
    let gender: 'MALE' | 'FEMALE' | null = null;
    if (genderRaw) {
      const g = genderRaw.toUpperCase();
      gender = g.startsWith('L') ? 'MALE' : g.startsWith('P') ? 'FEMALE' : null;
    }

    const address = grab(/Alamat\s*[:.]?\s*([A-Z0-9 .,\/\-]+)/i);
    const rtRw = grab(/RT\/?RW\s*[:.]?\s*([0-9]{1,3}\/[0-9]{1,3})/i);
    const village = grab(/Kel\/?Desa\s*[:.]?\s*([A-Z ]+)/i);
    const district = grab(/Kecamatan\s*[:.]?\s*([A-Z ]+)/i);
    const religion = grab(/Agama\s*[:.]?\s*([A-Z ]+)/i);
    const maritalStatus = grab(/Status\s*Perkawinan\s*[:.]?\s*([A-Z ]+)/i);
    const occupation = grab(/Pekerjaan\s*[:.]?\s*([A-Z ]+)/i);
    const nationality = grab(/Kewarganegaraan\s*[:.]?\s*([A-Z]+)/i);

    return {
      nik: nik && /^\d{16}$/.test(nik) ? nik : null,
      fullName,
      birthPlace,
      birthDate,
      gender,
      address,
      rtRw,
      village,
      district,
      religion,
      maritalStatus,
      occupation,
      nationality,
      rawText,
      confidence,
    };
  }
}
