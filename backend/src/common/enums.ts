/**
 * Enumeraciones del dominio.
 *
 * PostgreSQL las almacena como tipos ENUM nativos, de modo que Prisma las
 * genera en su cliente. Este módulo las reexporta para que el resto de la
 * aplicación no dependa directamente de `@prisma/client`: si algún día vuelve
 * a cambiar el motor, solo hay que tocar este archivo.
 */

export {
  RecordStatus,
  AttendanceType,
  AttendanceStatus,
  AuditAction,
  SettingType,
} from '@prisma/client';

import {
  AttendanceStatus as PrismaAttendanceStatus,
  AttendanceType as PrismaAttendanceType,
  AuditAction as PrismaAuditAction,
  RecordStatus as PrismaRecordStatus,
} from '@prisma/client';

/**
 * Con enumeraciones nativas, Prisma ya devuelve los campos tipados y estos
 * helpers dejan de ser necesarios para leer. Se conservan como identidad
 * tipada para los pocos puntos donde el valor llega como texto libre
 * (parámetros de consulta, importaciones).
 */
export const asRecordStatus = (value: string): PrismaRecordStatus =>
  value as PrismaRecordStatus;
export const asAttendanceType = (value: string): PrismaAttendanceType =>
  value as PrismaAttendanceType;
export const asAttendanceStatus = (value: string): PrismaAttendanceStatus =>
  value as PrismaAttendanceStatus;
export const asAuditAction = (value: string): PrismaAuditAction => value as PrismaAuditAction;

/** Etiquetas en español para exportaciones e interfaz. */
export const ATTENDANCE_STATUS_LABEL: Record<PrismaAttendanceStatus, string> = {
  ON_TIME: 'Puntual',
  LATE: 'Tarde',
  EARLY_DEPARTURE: 'Salida anticipada',
};

export const ATTENDANCE_TYPE_LABEL: Record<PrismaAttendanceType, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
};

export const AUDIT_ACTION_LABEL: Record<PrismaAuditAction, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Inactivación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  ATTENDANCE: 'Asistencia',
};
