import type { ApiEnvelope } from '@/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Origen del servidor, sin el prefijo /api/v1.
 * Los archivos subidos se sirven fuera de ese prefijo.
 */
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+\/?$/, '');

/** Convierte una ruta relativa del servidor en una URL absoluta utilizable en <img>. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

const ACCESS_TOKEN_KEY = 'aqr.access_token';
const REFRESH_TOKEN_KEY = 'aqr.refresh_token';

// ───────────────────────── Almacenamiento ────────────────────────

export const tokenStorage = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  save(accessToken: string, refreshToken: string) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ─────────────────────────── Errores ─────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Mensaje listo para mostrar, incluyendo el detalle de validación. */
  get detail(): string {
    return this.errors?.length ? this.errors.join(' · ') : this.message;
  }
}

// ──────────────────────── Refresh de sesión ──────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStorage.refresh;
  if (!refreshToken) return false;

  // Una sola renovación concurrente por más peticiones que fallen a la vez
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const body = (await response.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      tokenStorage.save(body.data.accessToken, body.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Se libera en el siguiente tick para que las llamadas en cola reutilicen el resultado
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

function forceLogout() {
  tokenStorage.clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = `/login?expired=1`;
  }
}

// ────────────────────────── Cliente HTTP ─────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Evita el intento de renovación automática (usado por el propio login). */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const token = tokenStorage.access;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && retry && !skipAuth) {
    const renewed = await refreshSession();
    if (renewed) return request<T>(path, options, false);
    forceLogout();
    throw new ApiError('La sesión expiró. Inicie sesión nuevamente.', 401);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'No fue posible completar la operación',
      response.status,
      payload?.errors,
    );
  }

  return (payload as ApiEnvelope<T>).data;
}

/**
 * Envía un archivo con `multipart/form-data`.
 * No se fija Content-Type a propósito: el navegador debe añadir el `boundary`.
 */
async function upload<T>(path: string, form: FormData, retry = true): Promise<T> {
  const token = tokenStorage.access;
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (response.status === 401 && retry) {
    const renewed = await refreshSession();
    if (renewed) return upload<T>(path, form, false);
    forceLogout();
    throw new ApiError('La sesión expiró. Inicie sesión nuevamente.', 401);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'No fue posible subir el archivo',
      response.status,
      payload?.errors,
    );
  }

  return (payload as ApiEnvelope<T>).data;
}

/** Descarga un archivo (Excel) respetando la sesión activa. */
async function download(path: string, retry = true): Promise<Blob> {
  const token = tokenStorage.access;
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401 && retry) {
    const renewed = await refreshSession();
    if (renewed) return download(path, false);
    forceLogout();
    throw new ApiError('La sesión expiró. Inicie sesión nuevamente.', 401);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message ?? 'No fue posible generar el archivo', response.status);
  }

  return response.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload,
  download,
};
