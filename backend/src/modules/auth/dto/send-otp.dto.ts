/**
 * File: backend/src/modules/auth/dto/send-otp.dto.ts
 * Fungsi: Validasi payload POST /auth/send-otp.
 */

import { ApiProperty } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email atau nomor HP target OTP' })
  @IsString()
  @MinLength(5)
  target!: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.REGISTER })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
