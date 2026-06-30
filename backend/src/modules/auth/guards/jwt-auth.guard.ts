/**
 * File: backend/src/modules/auth/guards/jwt-auth.guard.ts
 * Fungsi:
 *  - Guard berbasis Passport JWT strategy ('jwt').
 *  - Endpoint dengan decorator @Public() akan di-skip.
 *  - Endpoint lain wajib menyertakan Authorization: Bearer <token>.
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
