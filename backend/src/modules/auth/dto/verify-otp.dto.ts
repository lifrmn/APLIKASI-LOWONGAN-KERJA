/**
 * File: backend/src/modules/auth/dto/verify-otp.dto.ts
 * Fungsi: Validasi payload POST /auth/verify-otp.
 */

import { ApiProperty } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';
import { IsEnum, IsString, Length, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @MinLength(5)
  target!: string;

  @ApiProperty({ example: '123456', description: 'Kode OTP 6 digit' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.REGISTER })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
