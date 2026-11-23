/**
 * HTTP client: axios instance, bearer token injection, single-flight refresh-token rotation,
 * and typed helpers that unwrap the `{ success, data, meta }` envelope.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { config } from '@/config';
import { API, HTTP, STORAGE_KEYS } from '@/constants/api';
import { MESSAGES } from '@/constants/ui';
import type { ApiErrorBody, Page, QueryParams, TokenPair } from '@/types';

/** Normalised error thrown by every service call. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

// ─── Token storage: access token in memory, refresh token persisted ───
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

const safeStorage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
};

export const tokenStore = {
  setTokens(tokens: TokenPair) {
    accessToken = tokens.accessToken;
    safeStorage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  },
  getRefreshToken: () => safeStorage.get(STORAGE_KEYS.REFRESH_TOKEN),
  hasSession: () => !!accessToken || !!safeStorage.get(STORAGE_KEYS.REFRESH_TOKEN),
  clear() {
    accessToken = null;
    safeStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  },
  onExpired(cb: () => void) {
    onSessionExpired = cb;
  },
};

const client: AxiosInstance = axios.create({ baseURL: config.apiBaseUrl, timeout: HTTP.TIMEOUT_MS });

client.interceptors.request.use((req) => {
  if (accessToken) req.headers.Authorization = `Bearer ${accessToken}`;
  return req;
});

let refreshing: Promise<string | null> | null = null;

/** Exchanges the refresh token once, even when many requests fail concurrently. */
export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshing) {
    const rt = tokenStore.getRefreshToken();
    refreshing = (
      rt
        ? axios
            .post<{ data: TokenPair }>(`${config.apiBaseUrl}${API.AUTH.REFRESH}`, { refreshToken: rt })
            .then((r) => {
              tokenStore.setTokens(r.data.data);
              return r.data.data.accessToken;
            })
            .catch(() => {
              tokenStore.clear();
              return null;
            })
        : Promise.resolve(null)
    ).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ error?: ApiErrorBody }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === HTTP.UNAUTHORIZED && original && !original._retry && !isAuthCall) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      }
      onSessionExpired?.();
    }
    return Promise.reject(toApiError(error));
  },
);

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  const ax = error as AxiosError<{ error?: ApiErrorBody } | Blob>;
  if (!ax.response) return new ApiError(MESSAGES.NETWORK_ERROR, 0, 'NETWORK');
  const body = ax.response.data as { error?: ApiErrorBody } | undefined;
  const e = body && 'error' in body ? body.error : undefined;
  return new ApiError(e?.message ?? MESSAGES.GENERIC_ERROR, ax.response.status, e?.code ?? 'ERROR', e?.details);
};

const clean = (params?: QueryParams) =>
  params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) : undefined;

export const http = {
  async get<T>(url: string, params?: QueryParams): Promise<T> {
    const r = await client.get<{ data: T }>(url, { params: clean(params) });
    return r.data.data;
  },
  async page<T>(url: string, params?: QueryParams): Promise<Page<T>> {
    const r = await client.get<{ data: T[]; meta: Page<T>['meta'] }>(url, { params: clean(params) });
    return { items: r.data.data, meta: r.data.meta };
  },
  async post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const r = await client.post<{ data: T }>(url, body, { headers });
    return r.data?.data as T;
  },
  async patch<T>(url: string, body?: unknown): Promise<T> {
    const r = await client.patch<{ data: T }>(url, body);
    return r.data?.data as T;
  },
  async put<T>(url: string, body?: unknown): Promise<T> {
    const r = await client.put<{ data: T }>(url, body);
    return r.data?.data as T;
  },
  async del(url: string): Promise<void> {
    await client.delete(url);
  },
  async upload<T>(url: string, form: FormData): Promise<T> {
    const r = await client.post<{ data: T }>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.data;
  },
  async blob(url: string, params?: QueryParams): Promise<Blob> {
    const r = await client.get<Blob>(url, { params: clean(params), responseType: 'blob' });
    return r.data;
  },
};
