/**
 * File: backend/src/modules/auth/dto/refresh-token.dto.ts
 * Fungsi: Validasi payload POST /auth/refresh-token.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token yang valid (JWT)' })
  @IsString()
  @IsJWT({ message: 'Refresh token tidak valid' })
  refreshToken!: string;
}
