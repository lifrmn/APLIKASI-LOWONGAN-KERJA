/**
 * File: backend/src/modules/auth/guards/roles.guard.ts
 * Fungsi:
 *  - Guard RBAC. Membaca metadata dari @Roles(...) lalu mencocokkan
 *    dengan role user yang sudah dilampirkan oleh JwtStrategy.
 *  - Jika endpoint tidak punya @Roles, lolos otomatis.
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('User tidak terautentikasi');

    // SUPER_ADMIN selalu lolos, apapun decorator @Roles-nya.
    if (user.role === 'SUPER_ADMIN') return true;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke resource ini');
    }
    return true;
  }
}
