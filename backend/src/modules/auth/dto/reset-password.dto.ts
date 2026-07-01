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
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
  })
  newPassword!: string;
}
