/**
 * File: backend/src/modules/ocr-ektp/dto/verify-ocr.dto.ts
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyOcrDto {
  @ApiPropertyOptional({ description: 'Catatan verifikasi (opsional)' })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class RejectOcrDto {
  @ApiProperty({ description: 'Alasan penolakan (wajib)' })
  @IsString() @MinLength(5) @MaxLength(500)
  reason!: string;
}
