/**
 * File: backend/src/modules/auth/auth.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk autentikasi:
 *      POST /auth/register
 *      POST /auth/login
 *      POST /auth/logout
 *      POST /auth/refresh-token
 *      POST /auth/forgot-password
 *      POST /auth/reset-password
 *      POST /auth/send-otp
 *      POST /auth/verify-otp
 *      GET  /auth/me
 *  - Endpoint @Public() tidak butuh JWT.
 *  - Endpoint /logout & /me butuh JWT (dilindungi JwtAuthGuard global).
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { success } from '../../common/utils/api-response.util';
import { AuthService, RequestContext } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * ctxOf()
   * Ekstrak IP & User-Agent dari request untuk audit log.
   */
  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrasi user baru' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const data = await this.auth.register(dto, this.ctxOf(req));
    return success(data, 'Registrasi berhasil. Silakan verifikasi akun Anda.');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login dan dapatkan access + refresh token' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const tokens = await this.auth.login(dto, this.ctxOf(req));
    return success(tokens, 'Login berhasil');
  }

  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Logout user yang sedang login' })
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.auth.logout(user.id, this.ctxOf(req));
    return success(null, 'Logout berhasil');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  @ApiOperation({ summary: 'Perbarui access token menggunakan refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const tokens = await this.auth.refreshToken(dto.refreshToken, this.ctxOf(req));
    return success(tokens, 'Token berhasil diperbarui');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Kirim OTP reset password ke email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const data = await this.auth.forgotPassword(dto);
    return success(data, 'Jika email terdaftar, OTP reset password telah dikirim');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password menggunakan OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const data = await this.auth.resetPassword(dto, this.ctxOf(req));
    return success(data, 'Password berhasil direset');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  @ApiOperation({ summary: 'Kirim OTP untuk tujuan tertentu' })
  async sendOtp(@Body() dto: SendOtpDto) {
    const data = await this.auth.sendOtp(dto);
    return success(data, 'OTP berhasil dibuat');
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verifikasi OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const data = await this.auth.verifyOtp(dto, this.ctxOf(req));
    return success(data, 'OTP terverifikasi');
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Ambil profil user yang sedang login' })
  async me(@CurrentUser() user: AuthUser) {
    const data = await this.auth.me(user.id);
    return success(data, 'Profil berhasil diambil');
  }
}
