/**
 * File: backend/src/modules/auth/dto/register.dto.ts
 * Fungsi: Validasi payload POST /auth/register.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email tidak valid' })
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Minimal 10 karakter, huruf besar+kecil+angka+simbol',
  })
  @IsString()
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
  })
  password!: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor HP tidak valid' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'JOB_SEEKER',
    description: 'Role yang dipilih saat register (default JOB_SEEKER)',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
