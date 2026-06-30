/**
 * File: backend/src/common/decorators/public.decorator.ts
 * Fungsi:
 *  - Decorator @Public() untuk menandai endpoint yang TIDAK butuh
 *    JWT (mis. /auth/login, /auth/register).
 *  - Metadata ini dibaca oleh JwtAuthGuard agar guard di-skip.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
