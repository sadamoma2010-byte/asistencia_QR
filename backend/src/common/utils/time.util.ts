import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Bogota';

/** Convierte un instante UTC a la hora local institucional. */
export function toLocal(date: Date, timeZone: string = APP_TIMEZONE): Date {
  return toZonedTime(date, timeZone);
}

/** `YYYY-MM-DD` en la zona horaria institucional. */
export function localDateKey(date: Date, timeZone: string = APP_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

/** `HH:mm` en la zona horaria institucional. */
export function localTimeKey(date: Date, timeZone: string = APP_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, 'HH:mm');
}

/** Día de la semana local: 0 = domingo … 6 = sábado. */
export function localDayOfWeek(date: Date, timeZone: string = APP_TIMEZONE): number {
  return Number(formatInTimeZone(date, timeZone, 'i')) % 7;
}

/** Convierte `HH:mm` a minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a `HH:mm`. */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Fecha "solo día" almacenable en una columna `@db.Date`.
 * Se ancla a medianoche UTC para evitar corrimientos por zona horaria.
 */
export function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Rango [inicio, fin] de un día local expresado como fechas `@db.Date`. */
export function dayRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = dateOnly(from);
  if (to) range.lte = dateOnly(to);
  return range;
}

/** Diferencia en minutos entre la hora real y la esperada (positivo = tarde). */
export function diffMinutes(actual: string, expected: string): number {
  return timeToMinutes(actual) - timeToMinutes(expected);
}

/** Formato legible para reportes: `07/08/2026 07:12`. */
export function formatDateTime(date: Date, timeZone: string = APP_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, 'dd/MM/yyyy HH:mm');
}

/** Formato legible de fecha: `07/08/2026`. */
export function formatDate(date: Date, timeZone: string = APP_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, 'dd/MM/yyyy');
}

export const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;
