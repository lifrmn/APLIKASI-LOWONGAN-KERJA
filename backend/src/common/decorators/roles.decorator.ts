/**
 * File: backend/src/common/decorators/roles.decorator.ts
 * Fungsi:
 *  - Decorator @Roles('SUPER_ADMIN', 'ADMIN_DINAS') untuk menandai
 *    endpoint mana yang hanya boleh diakses role tertentu.
 *  - Metadata ini dibaca oleh RolesGuard.
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles()
 * @param roles Daftar nama role yang diizinkan (sesuai field Role.name di DB).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
