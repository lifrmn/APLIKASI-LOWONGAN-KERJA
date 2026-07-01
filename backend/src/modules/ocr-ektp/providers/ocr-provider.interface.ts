/**
 * File: backend/src/modules/ocr-ektp/providers/ocr-provider.interface.ts
 * Fungsi:
 *  - Abstraksi OCR provider (mock/Tesseract/eksternal).
 *  - Controller & service tidak boleh menyentuh implementasi provider
 *    langsung — cukup lewat token OCR_PROVIDER.
 */

export interface OcrEktpExtraction {
  nik: string | null;
  fullName: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  gender: 'MALE' | 'FEMALE' | null;
  address: string | null;
  rtRw: string | null;
  village: string | null;
  district: string | null;
  religion: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  nationality: string | null;
  rawText: string | null;
  confidence: number | null; // 0..1
}

export interface OcrProvider {
  /**
   * extract()
   * Membaca gambar e-KTP dan mengembalikan field terstruktur.
   * Implementasi mock akan mengembalikan data dummy deterministic
   * berdasarkan fileId sehingga aman untuk testing.
   */
  extract(fileAbsolutePath: string, fileId: string): Promise<OcrEktpExtraction>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
