/**
 * File: backend/src/modules/auth/strategies/jwt.strategy.ts
 * Fungsi:
 *  - Passport strategy untuk verifikasi JWT access token.
 *  - Mengambil token dari header Authorization: Bearer <token>.
 *  - validate() dipanggil otomatis jika signature & exp valid,
 *    hasilnya akan ditempel ke request.user.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../database/prisma.service';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

/**
 * JwtPayload
 * Bentuk payload yang ditulis ke JWT saat login.
 */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'change-me',
    });
  }

  /**
   * validate()
   * Dipanggil oleh Passport setelah token diverifikasi.
   * Memastikan user masih ada & aktif, lalu mengembalikan AuthUser.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User tidak ditemukan');
    }
    if (user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role.name,
    };
  }
}
