import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuth } from './auth';

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const { refreshToken, setAccessToken, clear } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
    const newAccess: string | undefined =
      res.data?.data?.accessToken ?? res.data?.accessToken;
    if (!newAccess) {
      clear();
      return null;
    }
    setAccessToken(newAccess);
    return newAccess;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? tryRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// -------- helpers -------------------------------------------------
export function unwrap<T = unknown>(data: any): T {
  // backend membungkus { success, message, data }
  return (data?.data ?? data) as T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
