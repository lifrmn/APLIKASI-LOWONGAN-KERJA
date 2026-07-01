import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions?: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (payload: { accessToken: string; refreshToken?: string | null; user: AuthUser }) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken: refreshToken ?? get().refreshToken, user }),
      setAccessToken: (token) => set({ accessToken: token }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
      hasRole: (...roles) => {
        const r = get().user?.role;
        return !!r && roles.includes(r);
      },
      hasPermission: (permission) => {
        const u = get().user;
        if (!u) return false;
        if (u.role === 'SUPER_ADMIN') return true;
        return (u.permissions ?? []).includes(permission);
      },
    }),
    { name: 'sulbar-kerja-admin-auth' },
  ),
);
