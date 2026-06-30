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
import { ApplicationsModule } from './modules/applications/applications.module';
import { ChatModule } from './modules/chat/chat.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { FilesModule } from './modules/files/files.module';
import { JobSeekersModule } from './modules/job-seekers/job-seekers.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

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
    UsersModule,
    RolesModule,
    PermissionsModule,
    JobSeekersModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    FilesModule,
    NotificationsModule,
    ChatModule,

    // TODO: DashboardModule, AuditLogsModule, dll.
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
