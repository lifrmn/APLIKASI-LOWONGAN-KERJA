/**
 * File: backend/src/common/utils/masking.util.ts
 * Fungsi:
 *  - Helper masking data sensitif (NIK, email, phone) sesuai
 *    aturan keamanan aplikasi Sulbar Kerja.
 *  - Dipakai pada response DTO agar data sensitif tidak bocor ke
 *    frontend/aktor yang tidak berwenang.
 */

/**
 * maskNik()
 * Format: 4 digit awal + '*' + 4 digit akhir.
 * Contoh: 7604010101010001 -> 7604********0001.
 */
export function maskNik(nik?: string | null): string | null {
  if (!nik) return null;
  const s = nik.trim();
  if (s.length < 8) return '****';
  return `${s.slice(0, 4)}${'*'.repeat(Math.max(0, s.length - 8))}${s.slice(-4)}`;
}

/**
 * maskEmail()
 * Format: huruf pertama + '*' + '@' + domain.
 * Contoh: userexample@gmail.com -> u**********@gmail.com.
 */
export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  const head = user[0] ?? '';
  return `${head}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

/**
 * maskPhone()
 * Format: 4 digit awal + '*' + 4 digit akhir.
 * Contoh: 081234567890 -> 0812****7890.
 */
export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const s = phone.replace(/\s+/g, '');
  if (s.length < 8) return '****';
  return `${s.slice(0, 4)}${'*'.repeat(Math.max(0, s.length - 8))}${s.slice(-4)}`;
}

/**
 * maskAddress()
 * Sembunyikan sebagian alamat setelah 8 karakter pertama.
 */
export function maskAddress(address?: string | null): string | null {
  if (!address) return null;
  const s = address.trim();
  if (s.length <= 8) return s;
  return `${s.slice(0, 8)}${'*'.repeat(Math.min(12, s.length - 8))}`;
}
