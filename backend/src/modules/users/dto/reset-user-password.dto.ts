/**
 * File: backend/src/modules/users/dto/reset-user-password.dto.ts
 * Fungsi: Validasi payload PATCH /users/:id/reset-password
 *         (reset password user oleh admin).
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  newPassword!: string;
}
