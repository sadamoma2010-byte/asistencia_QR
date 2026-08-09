// ─────────────────────────── Base ───────────────────────────

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'EARLY_DEPARTURE';
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ATTENDANCE';

export interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ──────────────────────── Autenticación ─────────────────────

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  document: string;
  phone: string | null;
  status: RecordStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  role: { id: string; name: string; description: string | null };
  permissions: string[];
  teacher: { id: string; code: string; status: RecordStatus } | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: SessionUser;
}

// ──────────────────────────── Módulos ───────────────────────

export interface Role extends BaseEntity {
  name: string;
  description: string | null;
  isSystem: boolean;
  status: RecordStatus;
  _count?: { users: number; permissions: number };
  permissions?: Permission[];
  permissionIds?: string[];
}

export interface Permission extends BaseEntity {
  code: string;
  name: string;
  module: string;
  description: string | null;
  isSystem: boolean;
  status: RecordStatus;
  _count?: { roles: number };
  roles?: { id: string; name: string }[];
}

export interface PermissionGroup {
  module: string;
  permissions: Pick<Permission, 'id' | 'code' | 'name' | 'module' | 'description'>[];
}

export interface User extends BaseEntity {
  firstName: string;
  lastName: string;
  document: string;
  email: string;
  phone: string | null;
  status: RecordStatus;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  roleId: string;
  role: { id: string; name: string; description: string | null };
  teacher: { id: string; code: string } | null;
}

export interface Subject extends BaseEntity {
  code: string;
  name: string;
  description: string | null;
  weeklyHours: number | null;
  color: string | null;
  status: RecordStatus;
  teachers?: Pick<Teacher, 'id' | 'code' | 'firstName' | 'lastName' | 'status'>[];
  _count?: { teachers: number; schedules: number };
}

/** Versión reducida que devuelven los catálogos y las relaciones. */
export interface SubjectRef {
  id: string;
  code: string;
  name: string;
  color?: string | null;
}

export interface Teacher extends BaseEntity {
  code: string;
  firstName: string;
  lastName: string;
  document: string;
  email: string;
  phone: string | null;
  /** Ruta relativa servida por la API, ej. /uploads/teachers/xxx.webp */
  photoUrl: string | null;
  status: RecordStatus;
  userId: string | null;
  user?: { id: string; email: string; status: RecordStatus; role: { name: string } } | null;
  /** Asignaturas que dicta, ya aplanadas por el backend. */
  subjects: SubjectRef[];
  schedules?: Schedule[];
  _count?: { schedules: number; attendances: number };
}

export interface Shift extends BaseEntity {
  name: string;
  description: string | null;
  status: RecordStatus;
  _count?: { schedules: number };
}

export interface Schedule extends BaseEntity {
  teacherId: string;
  shiftId: string;
  subjectId: string | null;
  subject: SubjectRef | null;
  dayOfWeek: number | null;
  dayName?: string;
  checkInTime: string;
  checkOutTime: string;
  toleranceMinutes: number;
  status: RecordStatus;
  teacher: { id: string; code: string; firstName: string; lastName: string; status: RecordStatus };
  shift: { id: string; name: string; status: RecordStatus };
}

export interface Attendance extends BaseEntity {
  teacherId: string;
  scheduleId: string | null;
  type: AttendanceType;
  status: AttendanceStatus;
  date: string;
  registeredAt: string;
  expectedTime: string | null;
  minutesDiff: number;
  ipAddress: string | null;
  device: string | null;
  notes: string | null;
  teacher: { id: string; code: string; firstName: string; lastName: string; document: string };
  schedule: {
    id: string;
    checkInTime: string;
    checkOutTime: string;
    toleranceMinutes: number;
    dayOfWeek: number | null;
    shift: { id: string; name: string };
  } | null;
  message?: string;
}

export interface AuditLog extends BaseEntity {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: AuditAction;
  module: string;
  entityId: string | null;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Setting extends BaseEntity {
  key: string;
  value: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  group: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  isSystem: boolean;
}

export interface SettingGroup {
  group: string;
  settings: Setting[];
}

export interface QrConfig {
  publicUrl: string;
  institutionName: string;
  updatedAt: string;
}

export interface QrHistoryEntry {
  id: string;
  description: string;
  userName: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  device: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ───────────────────────── Panel docente ────────────────────

export interface SelfAttendanceStatus {
  teacher: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    status: RecordStatus;
  } | null;
  date: string;
  dayName: string;
  currentTime: string;
  timezone: string;
  schedules: (Schedule & { shift: { id: string; name: string } })[];
  todayRecords: Attendance[];
  lastRecord: Attendance | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  blockedReason: string | null;
}

// ─────────────────────── Dashboard y reportes ───────────────

export interface DashboardData {
  date: string;
  kpis: {
    totalTeachers: number;
    activeTeachers: number;
    attendancesToday: number;
    lateToday: number;
    recordsToday: number;
    onTimeToday: number;
    checkInsToday: number;
    checkOutsToday: number;
    punctualityRate: number;
    coverageRate: number;
    pendingCheckOut: number;
  };
  trend: { date: string; onTime: number; late: number; total: number }[];
  recent: (Attendance & { schedule: { shift: { name: string } } | null })[];
  topLateTeachers: { teacherId: string; code: string; fullName: string; lateCount: number }[];
}

export interface TeacherReportRow {
  teacherId: string;
  code: string;
  fullName: string;
  document: string;
  shifts: string;
  totalRecords: number;
  checkIns: number;
  checkOuts: number;
  onTime: number;
  late: number;
  earlyDeparture: number;
  totalLateMinutes: number;
  punctualityRate: number;
}

// ──────────────────────────── Catálogos ─────────────────────

export interface Option {
  id: string;
  name?: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  description?: string | null;
}
