/**
 * File: backend/src/common/utils/env-validation.ts
 * Fungsi:
 *  - Validasi ENV secara fail-fast sebelum aplikasi boot.
 *  - Wajib: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 *      (JWT secret minimal 32 karakter, tidak boleh berisi kata "ubah"
 *       atau nilai default template).
 *  - Di NODE_ENV=production ada aturan tambahan:
 *      * CORS_ORIGINS wajib eksplisit (tanpa "*")
 *      * SWAGGER_ENABLED harus false (kecuali dipaksa)
 *      * BCRYPT_SALT_ROUNDS >= 10
 *      * Secret tidak boleh contoh "dev_*"
 */

const WEAK_TOKENS = [
  'ubah_dengan_secret',
  'change_me',
  'changeme',
  'default',
  'secret',
  'password',
  'dev_access_secret',
  'dev_refresh_secret',
];

export interface EnvIssue {
  key: string;
  message: string;
}

export function validateEnv(env: NodeJS.ProcessEnv): void {
  const issues: EnvIssue[] = [];
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  // --- Wajib selalu ada ---
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const k of required) {
    if (!env[k] || env[k]!.trim() === '') {
      issues.push({ key: k, message: 'wajib diisi' });
    }
  }

  // --- Kekuatan secret JWT ---
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = env[k];
    if (!v) continue;
    if (v.length < 32) {
      issues.push({ key: k, message: 'minimal 32 karakter' });
    }
    const lower = v.toLowerCase();
    if (WEAK_TOKENS.some((w) => lower.includes(w))) {
      if (isProd) issues.push({ key: k, message: 'terdeteksi placeholder/lemah, GANTI di produksi' });
    }
  }

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    issues.push({
      key: 'JWT_REFRESH_SECRET',
      message: 'harus berbeda dari JWT_ACCESS_SECRET',
    });
  }

  // --- Bcrypt cost ---
  const rounds = Number(env.BCRYPT_SALT_ROUNDS ?? 10);
  if (isNaN(rounds) || rounds < 10 || rounds > 15) {
    issues.push({ key: 'BCRYPT_SALT_ROUNDS', message: 'harus angka 10..15' });
  }

  // --- Rules khusus produksi ---
  if (isProd) {
    const cors = (env.CORS_ORIGINS ?? '').trim();
    if (!cors || cors.split(',').map((s) => s.trim()).includes('*')) {
      issues.push({
        key: 'CORS_ORIGINS',
        message: 'di produksi wajib whitelist eksplisit (tanpa "*")',
      });
    }
    if ((env.SWAGGER_ENABLED ?? 'false') === 'true' && env.EXPOSE_SWAGGER_PRODUCTION !== 'true') {
      issues.push({
        key: 'SWAGGER_ENABLED',
        message: 'nonaktifkan di produksi (atau set EXPOSE_SWAGGER_PRODUCTION=true bila memang perlu)',
      });
    }
    if ((env.APP_URL ?? '').startsWith('http://')) {
      issues.push({ key: 'APP_URL', message: 'wajib HTTPS di produksi' });
    }
  }

  if (issues.length > 0) {
    const msg = ['ENV VALIDATION FAILED:', ...issues.map((i) => `  - ${i.key}: ${i.message}`)].join('\n');
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error('Environment tidak valid — perbaiki sebelum boot.');
  }
}
