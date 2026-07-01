/**
 * File: backend/src/modules/ocr-ektp/providers/mock-ocr.provider.ts
 * Fungsi:
 *  - Implementasi OcrProvider berbasis MOCK untuk MVP.
 *  - Tidak membaca gambar sungguhan — mengembalikan data dummy
 *    deterministic berbasis hash fileId agar hasil konsisten.
 *  - Sengaja meng-set confidence rendah supaya alur "wajib
 *    diverifikasi admin" tetap berjalan.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

import { OcrEktpExtraction, OcrProvider } from './ocr-provider.interface';

const DUMMY_NAMES = [
  'BUDI SANTOSO',
  'SITI RAHMAWATI',
  'AHMAD SUBAGYO',
  'DEWI LESTARI',
  'MUHAMMAD RIZKI',
  'ANNISA PUTRI',
];

const DUMMY_PLACES = ['MAMUJU', 'MAJENE', 'POLEWALI', 'MAKASSAR', 'JAKARTA', 'SURABAYA'];

const DUMMY_VILLAGES = ['SIMBORO', 'BINANGA', 'RANGAS', 'KAREMA', 'KALUKKU', 'TAPALANG'];

const DUMMY_DISTRICTS = ['MAMUJU', 'SIMBORO', 'KALUKKU', 'TAPALANG', 'PAPALANG', 'SAMPAGA'];

@Injectable()
export class MockOcrProvider implements OcrProvider {
  async extract(_fileAbsolutePath: string, fileId: string): Promise<OcrEktpExtraction> {
    // Hash deterministic — hasil konsisten untuk fileId yang sama.
    const digest = createHash('sha256').update(fileId).digest();
    const pick = (arr: string[], offset: number) => arr[digest[offset] % arr.length];

    // Buat NIK dummy 16 digit yang valid secara panjang.
    const nikDigits = Array.from(digest.slice(0, 8))
      .map((b) => (b % 10).toString())
      .join('') // 8 digit
      + Array.from(digest.slice(8, 16))
        .map((b) => (b % 10).toString())
        .join(''); // total 16
    const nik = nikDigits.slice(0, 16);

    const isMale = digest[0] % 2 === 0;
    const day = (digest[16] % 27) + 1;
    const month = (digest[17] % 12) + 1;
    const year = 1980 + (digest[18] % 30);
    const birthDate = new Date(Date.UTC(year, month - 1, day));

    return {
      nik,
      fullName: pick(DUMMY_NAMES, 20),
      birthPlace: pick(DUMMY_PLACES, 21),
      birthDate,
      gender: isMale ? 'MALE' : 'FEMALE',
      address: `JL. CONTOH NO. ${(digest[22] % 200) + 1}`,
      rtRw: `${((digest[23] % 20) + 1).toString().padStart(3, '0')}/${((digest[24] % 20) + 1).toString().padStart(3, '0')}`,
      village: pick(DUMMY_VILLAGES, 25),
      district: pick(DUMMY_DISTRICTS, 26),
      religion: 'ISLAM',
      maritalStatus: digest[27] % 2 === 0 ? 'BELUM KAWIN' : 'KAWIN',
      occupation: 'KARYAWAN SWASTA',
      nationality: 'WNI',
      rawText:
        'PROVINSI SULAWESI BARAT\nKABUPATEN MAMUJU\n[DUMMY MOCK OCR - HARAP VERIFIKASI MANUAL]',
      // sengaja rendah supaya admin wajib verify
      confidence: 0.55 + (digest[28] % 40) / 100,
    };
  }
}
