/**
 * File: backend/src/modules/notifications/fcm.service.ts
 * Fungsi:
 *  - Wrapper Firebase Cloud Messaging.
 *  - Inisialisasi Firebase Admin SDK secara lazy — hanya aktif bila
 *    env `FCM_SERVICE_ACCOUNT_PATH` atau `FCM_SERVICE_ACCOUNT_JSON`
 *    tersedia. Jika tidak, method kirim di-no-op agar backend tetap
 *    berjalan di lokal / staging tanpa konfigurasi Firebase.
 *
 * Setup produksi:
 *   1. Buat project di Firebase Console, download service account JSON.
 *   2. Set env:
 *        FCM_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase.json
 *      atau
 *        FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   3. Simpan token FCM device user di user_devices (belum ada di
 *      schema MVP; bila mau di-enable, tambah tabel `user_devices`
 *      dan panggil `sendToUser` di sini).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private enabled = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private admin: any = null;

  async onModuleInit(): Promise<void> {
    const pathEnv = process.env.FCM_SERVICE_ACCOUNT_PATH;
    const jsonEnv = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!pathEnv && !jsonEnv) {
      this.logger.log('FCM belum dikonfigurasi (env kosong); no-op mode');
      return;
    }
    try {
      // Import dinamis dgn string variable agar TS tidak mewajibkan
      // package terpasang saat kompilasi.
      const modName = 'firebase-admin';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(/* webpackIgnore: true */ modName).catch(() => null);
      if (!mod) {
        this.logger.warn('firebase-admin belum di-install; no-op mode');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin: any = mod.default ?? mod;
      const cred = jsonEnv
        ? admin.credential.cert(JSON.parse(jsonEnv))
        : admin.credential.cert(pathEnv!);
      if (!admin.apps?.length) {
        admin.initializeApp({ credential: cred });
      }
      this.admin = admin;
      this.enabled = true;
      this.logger.log('FCM initialised');
    } catch (e) {
      this.logger.error(`FCM init gagal: ${(e as Error).message}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * sendToTokens()
   * Kirim ke daftar device token (multicast).
   */
  async sendToTokens(tokens: string[], payload: FcmPayload): Promise<void> {
    if (!this.enabled || !this.admin || !tokens.length) return;
    try {
      await this.admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
    } catch (e) {
      this.logger.warn(`FCM send gagal: ${(e as Error).message}`);
    }
  }

  /**
   * sendToTopic()
   * Kirim ke topic (mis. 'announcement').
   */
  async sendToTopic(topic: string, payload: FcmPayload): Promise<void> {
    if (!this.enabled || !this.admin) return;
    try {
      await this.admin.messaging().send({
        topic,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
    } catch (e) {
      this.logger.warn(`FCM topic gagal: ${(e as Error).message}`);
    }
  }
}
