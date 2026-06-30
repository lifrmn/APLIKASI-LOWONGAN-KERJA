/**
 * File: backend/src/modules/audit-logs/enums/audit-action.enum.ts
 * Fungsi: Konstanta action umum sebagai referensi (bukan enum DB,
 *         karena kolom `action` di tabel berupa String fleksibel).
 *         Dipakai untuk autocomplete & dokumentasi.
 */

export const AUDIT_ACTIONS = [
  // Auth
  'REGISTER',
  'LOGIN',
  'LOGOUT',
  'RESET_PASSWORD',
  'VERIFY_OTP',

  // CRUD generic
  'CREATE',
  'UPDATE',
  'DELETE',
  'SOFT_DELETE',

  // Lifecycle
  'PUBLISH',
  'CLOSE',
  'DRAFT',
  'VERIFY',
  'REJECT',
  'CHANGE_STATUS',
  'CHANGE_ROLE',

  // File / Export
  'UPLOAD',
  'DOWNLOAD',
  'EXPORT',

  // Domain
  'APPLY_JOB',

  // Audit self
  'AUDIT_DELETE',
  'AUDIT_CLEAR_OLD',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_MODULES = [
  'AUTH',
  'USERS',
  'ROLES',
  'PERMISSIONS',
  'JOB_SEEKERS',
  'COMPANIES',
  'JOBS',
  'APPLICATIONS',
  'INTERVIEWS',
  'CHAT',
  'FILES',
  'NOTIFICATIONS',
  'DASHBOARD',
  'REPORTS',
  'AUDIT_LOGS',
  'AI',
  'OCR',
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];
