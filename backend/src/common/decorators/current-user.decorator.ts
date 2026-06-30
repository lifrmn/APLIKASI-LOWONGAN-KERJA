/**
 * File: backend/src/common/decorators/current-user.decorator.ts
 * Fungsi:
 *  - Decorator @CurrentUser() untuk meng-inject payload user yang
 *    sedang login (hasil JwtStrategy.validate) ke parameter handler.
 *  - Bisa ambil seluruh user atau field tertentu:
 *      @CurrentUser() user: AuthUser
 *      @CurrentUser('id') userId: string
 */

import { ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * AuthUser
 * Bentuk payload user yang ditempel di `request.user` setelah
 * JwtStrategy.validate() berhasil.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
