/**
 * Enumeraciones del dominio.
 *
 * SQLite no soporta tipos ENUM nativos, por lo que en el esquema de Prisma
 * estos campos se almacenan como `String`. Estas enumeraciones son la única
 * fuente de verdad para validación (class-validator), documentación (Swagger)
 * y tipado en toda la aplicación.
 */

export enum RecordStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum AttendanceType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

export enum AttendanceStatus {
  /** PUNTUAL — RN008 */
  ON_TIME = 'ON_TIME',
  /** TARDE — RN007 */
  LATE = 'LATE',
  /** SALIDA ANTICIPADA */
  EARLY_DEPARTURE = 'EARLY_DEPARTURE',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ACTIVATE = 'ACTIVATE',
  DEACTIVATE = 'DEACTIVATE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ATTENDANCE = 'ATTENDANCE',
}

export enum SettingType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

/**
 * Prisma devuelve estos campos como `string`. Estos helpers los estrechan
 * al tipo de la enumeración sin recurrir a `as` disperso por el código.
 */
export const asRecordStatus = (value: string): RecordStatus => value as RecordStatus;
export const asAttendanceType = (value: string): AttendanceType => value as AttendanceType;
export const asAttendanceStatus = (value: string): AttendanceStatus => value as AttendanceStatus;
export const asAuditAction = (value: string): AuditAction => value as AuditAction;
