/**
 * File: backend/src/modules/auth/dto/forgot-password.dto.ts
 * Fungsi: Validasi payload POST /auth/forgot-password.
 *         Sistem akan mengirim OTP RESET_PASSWORD ke email user.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email tidak valid' })
  email!: string;
}
