/**
 * File: backend/src/app.module.ts
 * Fungsi:
 *  - Root module aplikasi NestJS.
 *  - Memuat ConfigModule (env), ThrottlerModule (rate limit),
 *    dan DatabaseModule (PrismaService).
 *  - Module-module fitur (Auth, Users, Jobs, dll) akan
 *    didaftarkan di sini pada tahap berikutnya.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    // Konfigurasi environment global, dibaca dari file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      cache: true,
    }),

    // Rate limiting global (anti brute-force / DoS sederhana)
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000, // ms
          limit: Number(process.env.THROTTLE_LIMIT ?? 100),
        },
      ],
    }),

    // Modul fitur tahap 1
    AuthModule,

    // TODO: UsersModule, RolesModule, PermissionsModule, JobSeekersModule,
    // CompaniesModule, JobsModule, ApplicationsModule, FilesModule,
    // DashboardModule, AuditLogsModule, dll. ditambahkan bertahap.
  ],
  providers: [
    // Rate limit global
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JWT global: semua endpoint butuh token kecuali ditandai @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RBAC global: aktif bila handler punya @Roles(...)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
