/**
 * File: backend/src/database/prisma.service.ts
 * Fungsi:
 *  - Wrapper PrismaClient sebagai injectable NestJS service.
 *  - Membuka koneksi ke database saat module init.
 *  - Menutup koneksi saat aplikasi destroy.
 *  - Menyediakan helper `enableShutdownHooks` agar Nest dapat
 *    melakukan graceful shutdown saat menerima sinyal terminate.
 *  - Menyediakan helper `cleanDatabase` khusus untuk testing.
 */

import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  /**
   * onModuleInit()
   * Dipanggil otomatis oleh Nest setelah module diinisialisasi.
   * Membuka koneksi ke PostgreSQL.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  /**
   * onModuleDestroy()
   * Dipanggil otomatis oleh Nest saat aplikasi dimatikan.
   * Menutup koneksi ke database dengan rapi.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }

  /**
   * enableShutdownHooks()
   * Mengaitkan event `beforeExit` Prisma ke `app.close()` Nest,
   * sehingga koneksi DB & resource lain ditutup dengan rapi.
   */
  enableShutdownHooks(app: INestApplication): void {
    // Cast diperlukan karena tipe event Prisma terbatas
    (this as unknown as { $on: (event: string, cb: () => Promise<void>) => void }).$on(
      'beforeExit',
      async () => {
        await app.close();
      },
    );
  }

  /**
   * cleanDatabase()
   * Khusus untuk environment test: menghapus seluruh data dari
   * tabel-tabel utama. JANGAN dipanggil di production.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() tidak boleh dipanggil di production');
    }
    // Implementasi pembersihan akan ditambahkan setelah model
    // Prisma final didefinisikan.
  }
}
