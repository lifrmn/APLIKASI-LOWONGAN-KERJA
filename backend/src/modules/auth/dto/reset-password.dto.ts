/**
 * File: backend/src/modules/auth/dto/reset-password.dto.ts
 * Fungsi: Validasi payload POST /auth/reset-password.
 *         User mengirim email + OTP + password baru.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email tidak valid' })
  email!: string;

  @ApiProperty({ example: '123456', description: 'OTP 6 digit' })
  @IsString()
  @Length(6, 6, { message: 'OTP harus 6 karakter' })
  otp!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  newPassword!: string;
}
