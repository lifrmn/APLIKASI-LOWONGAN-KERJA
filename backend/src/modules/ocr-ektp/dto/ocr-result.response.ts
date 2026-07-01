/**
 * File: backend/src/modules/ocr-ektp/dto/ocr-result.response.ts
 * Fungsi:
 *  - Response DTO OCR e-KTP dengan dua mode: MASKED (default) dan
 *    UNMASKED (hanya untuk owner atau admin dengan permission
 *    sensitive.identity.read).
 */

import { OcrEktpResult, OcrStatus } from '@prisma/client';

import { maskAddress, maskNik } from '../../../common/utils/masking.util';

export interface OcrResultDto {
  id: string;
  userId: string;
  fileId: string | null;
  status: OcrStatus;
  confidence: number | null;
  nik: string | null;
  fullName: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  gender: string | null;
  address: string | null;
  rtRw: string | null;
  village: string | null;
  district: string | null;
  religion: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  nationality: string | null;
  rawText?: string | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  masked: boolean;
}

export function toOcrResultDto(row: OcrEktpResult, unmasked: boolean): OcrResultDto {
  if (unmasked) {
    return {
      ...row,
      rawText: row.rawText,
      masked: false,
    };
  }
  return {
    id: row.id,
    userId: row.userId,
    fileId: row.fileId,
    status: row.status,
    confidence: row.confidence,
    nik: maskNik(row.nik),
    fullName: row.fullName,
    birthPlace: row.birthPlace,
    birthDate: row.birthDate,
    gender: row.gender,
    address: maskAddress(row.address),
    rtRw: row.rtRw,
    village: row.village,
    district: row.district,
    religion: row.religion,
    maritalStatus: row.maritalStatus,
    occupation: row.occupation,
    nationality: row.nationality,
    // rawText tidak diexpose saat masked
    verifiedAt: row.verifiedAt,
    verifiedById: row.verifiedById,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    masked: true,
  };
}
