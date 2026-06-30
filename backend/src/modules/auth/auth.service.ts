/**
 * File: backend/src/modules/auth/auth.service.ts
 * Fungsi:
 *  - Logika bisnis autentikasi:
 *      register, login, logout, refresh, me,
 *      sendOtp, verifyOtp, forgotPassword, resetPassword.
 *  - Mengelola password (bcrypt), JWT access & refresh,
 *    penyimpanan refresh token (hash) ke DB, dan audit log.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

/**
 * AuthTokens
 * Bentuk pasangan token yang dikembalikan setelah login/refresh.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

/**
 * RequestContext
 * Informasi tambahan dari request (IP & User-Agent) untuk audit log
 * & pelacakan refresh token per-device.
 */
export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  //                            REGISTER
  // ============================================================

  /**
   * register()
   * Membuat user baru:
   *  - Cek email belum dipakai.
   *  - Hash password bcrypt.
   *  - Assign role (default JOB_SEEKER).
   *  - Catat audit log USER_REGISTER.
   */
  async register(dto: RegisterDto, ctx: RequestContext): Promise<{ id: string; email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const roleName = dto.role ?? 'JOB_SEEKER';
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException(`Role "${roleName}" tidak tersedia`);

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        password: passwordHash,
        fullName: dto.fullName,
        roleId: role.id,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: { id: true, email: true },
    });

    await this.writeAudit(user.id, 'USER_REGISTER', 'User', user.id, ctx);
    return user;
  }

  // ============================================================
  //                             LOGIN
  // ============================================================

  /**
   * login()
   * Validasi kredensial → terbitkan access & refresh token,
   * simpan hash refresh token ke DB, catat audit log USER_LOGIN.
   */
  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user || user.deletedAt) throw new UnauthorizedException('Email atau password salah');
    if (user.status === 'BANNED') throw new UnauthorizedException('Akun diblokir');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Email atau password salah');

    const tokens = await this.issueTokens(user.id, user.email, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken, ctx);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.writeAudit(user.id, 'USER_LOGIN', 'User', user.id, ctx);
    return tokens;
  }

  // ============================================================
  //                            LOGOUT
  // ============================================================

  /**
   * logout()
   * Revoke seluruh refresh token aktif untuk user.
   * (Versi sederhana — bisa diperluas agar revoke per-device).
   */
  async logout(userId: string, ctx: RequestContext): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.writeAudit(userId, 'USER_LOGOUT', 'User', userId, ctx);
  }

  // ============================================================
  //                         REFRESH TOKEN
  // ============================================================

  /**
   * refreshToken()
   * - Verifikasi signature refresh token.
   * - Pastikan masih ada di DB & belum revoked & belum expired.
   * - Rotasi: revoke yang lama, terbitkan pasangan baru.
   */
  async refreshToken(refreshToken: string, ctx: RequestContext): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token sudah tidak berlaku');
    }
    if (stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token tidak konsisten');
    }

    // Rotasi: revoke token lama
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(payload.sub, payload.email, payload.role);
    await this.persistRefreshToken(payload.sub, tokens.refreshToken, ctx);
    return tokens;
  }

  // ============================================================
  //                              ME
  // ============================================================

  /**
   * me()
   * Ambil data user yang sedang login (untuk GET /auth/me).
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      role: user.role.name,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  // ============================================================
  //                              OTP
  // ============================================================

  /**
   * sendOtp()
   * Membuat OTP 6 digit, hash, simpan ke DB dengan expiry 10 menit.
   * Pengiriman email/SMS akan ditangani EmailModule/SmsModule
   * (tahap 2). Untuk dev, OTP dikembalikan ke response.
   */
  async sendOtp(dto: SendOtpDto): Promise<{ target: string; purpose: OtpPurpose; otp?: string }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.target }, { phone: dto.target }] },
    });

    const code = randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        userId: user?.id,
        target: dto.target,
        codeHash,
        purpose: dto.purpose,
        expiresAt,
      },
    });

    this.logger.log(`OTP ${dto.purpose} dibuat untuk ${dto.target}`);

    // Tampilkan OTP ke response hanya di non-production
    return {
      target: dto.target,
      purpose: dto.purpose,
      otp: this.config.get<string>('NODE_ENV') === 'production' ? undefined : code,
    };
  }

  /**
   * verifyOtp()
   * Verifikasi OTP terbaru yang belum dipakai & belum expired,
   * tandai sebagai used. Bila purpose REGISTER/VERIFY_EMAIL,
   * status user dinaikkan ke ACTIVE & emailVerifiedAt diisi.
   */
  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<{ verified: true }> {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        target: dto.target,
        purpose: dto.purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new BadRequestException('OTP tidak ditemukan atau sudah kadaluarsa');

    const match = await bcrypt.compare(dto.code, otp.codeHash);
    if (!match) throw new BadRequestException('Kode OTP salah');

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    if (otp.userId && (dto.purpose === 'REGISTER' || dto.purpose === 'VERIFY_EMAIL')) {
      await this.prisma.user.update({
        where: { id: otp.userId },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      });
      await this.writeAudit(otp.userId, 'USER_VERIFIED', 'User', otp.userId, ctx);
    }

    return { verified: true };
  }

  // ============================================================
  //                  FORGOT / RESET PASSWORD
  // ============================================================

  /**
   * forgotPassword()
   * Selalu mengembalikan sukses (anti user-enumeration).
   * Jika email terdaftar, OTP RESET_PASSWORD dibuat & dikirim.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user) {
      await this.sendOtp({ target: dto.email, purpose: OtpPurpose.RESET_PASSWORD });
    }
    return { sent: true };
  }

  /**
   * resetPassword()
   * Verifikasi OTP RESET_PASSWORD lalu update password user.
   * Semua refresh token lama di-revoke untuk keamanan.
   */
  async resetPassword(dto: ResetPasswordDto, ctx: RequestContext): Promise<{ reset: true }> {
    await this.verifyOtp(
      { target: dto.email, code: dto.otp, purpose: OtpPurpose.RESET_PASSWORD },
      ctx,
    );

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.writeAudit(user.id, 'USER_RESET_PASSWORD', 'User', user.id, ctx);
    return { reset: true };
  }

  // ============================================================
  //                         INTERNAL HELPERS
  // ============================================================

  /**
   * hashPassword()
   * Hash password dengan bcrypt (salt rounds dari env, default 10).
   */
  private async hashPassword(plain: string): Promise<string> {
    const rounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 10);
    return bcrypt.hash(plain, rounds);
  }

  /**
   * issueTokens()
   * Terbitkan access & refresh token dengan secret & expiry berbeda.
   */
  private async issueTokens(userId: string, email: string, role: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpires,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpires,
      }),
    ]);

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessExpires };
  }

  /**
   * persistRefreshToken()
   * Simpan hash refresh token (bukan plaintext) ke DB.
   * Memungkinkan revoke per-device & deteksi token re-use.
   */
  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<void> {
    const payload = this.jwt.decode(refreshToken) as { exp?: number } | null;
    const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 86400000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt,
      },
    });
  }

  /**
   * hashToken()
   * Hash refresh token dengan SHA-256 (sinkron, ringan).
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * writeAudit()
   * Tulis baris audit log. Selalu best-effort (tidak melempar error
   * supaya tidak menggagalkan flow utama).
   */
  private async writeAudit(
    userId: string | null,
    action: string,
    entity: string | null,
    entityId: string | null,
    ctx: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: metadata as never,
        },
      });
    } catch (e) {
      this.logger.warn(`Gagal menulis audit log: ${(e as Error).message}`);
    }
  }

  /**
   * sanitizeUser()
   * Helper untuk membuang field sensitif sebelum dikembalikan.
   */
  static sanitizeUser<T extends Partial<User>>(user: T): Omit<T, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as T & { password?: string };
    return rest;
  }
}
