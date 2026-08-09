import type { Request } from 'express';
import type { RequestContext } from '../types/authenticated-user';

/** Extrae IP, user agent y dispositivo de la petición para la auditoría. */
export function getRequestContext(req: Request): RequestContext {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    req.socket?.remoteAddress ??
    null;

  const userAgent = (req.headers['user-agent'] ?? null) as string | null;

  return {
    ipAddress: ipAddress ? ipAddress.replace('::ffff:', '').slice(0, 60) : null,
    userAgent: userAgent ? userAgent.slice(0, 400) : null,
    device: userAgent ? detectDevice(userAgent) : null,
  };
}

/** Etiqueta legible del dispositivo a partir del user agent. */
export function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  const platform = ua.includes('iphone')
    ? 'iPhone'
    : ua.includes('ipad')
      ? 'iPad'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('windows')
          ? 'Windows'
          : ua.includes('mac os')
            ? 'macOS'
            : ua.includes('linux')
              ? 'Linux'
              : 'Desconocido';

  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome') && !ua.includes('edg/')
      ? 'Chrome'
      : ua.includes('firefox')
        ? 'Firefox'
        : ua.includes('safari')
          ? 'Safari'
          : 'Navegador';

  const kind = /mobile|iphone|android/.test(ua) ? 'Móvil' : /ipad|tablet/.test(ua) ? 'Tablet' : 'Escritorio';

  return `${kind} · ${platform} · ${browser}`.slice(0, 120);
}
