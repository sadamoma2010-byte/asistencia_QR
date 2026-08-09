import { z } from 'zod';

// ────────────────────────── Reglas comunes ───────────────────────

const PASSWORD_RULE = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/\d/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial');

const NAME_RULE = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(120, 'Máximo 120 caracteres');

const DOCUMENT_RULE = z
  .string()
  .trim()
  .min(5, 'Mínimo 5 caracteres')
  .max(30, 'Máximo 30 caracteres')
  .regex(/^[A-Za-z0-9.-]+$/, 'Solo se admiten letras, números, punto y guion');

const EMAIL_RULE = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio')
  .email('El correo no tiene un formato válido')
  .max(180, 'Máximo 180 caracteres');

const PHONE_RULE = z
  .string()
  .trim()
  .max(30, 'Máximo 30 caracteres')
  .regex(/^[0-9+()\s-]*$/, 'Solo se admiten números y los signos + ( ) -')
  .optional()
  .or(z.literal(''));

const TIME_RULE = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:mm)');

const STATUS_RULE = z.enum(['ACTIVE', 'INACTIVE']);

// ───────────────────────── Autenticación ─────────────────────────

export const loginSchema = z.object({
  email: EMAIL_RULE,
  password: z.string().min(1, 'La contraseña es obligatoria').max(72),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: PASSWORD_RULE,
    confirmPassword: z.string().min(1, 'Confirme la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// ──────────────────────────── Usuarios ───────────────────────────

export const userSchema = z.object({
  firstName: NAME_RULE,
  lastName: NAME_RULE,
  document: DOCUMENT_RULE,
  email: EMAIL_RULE,
  phone: PHONE_RULE,
  roleId: z.string().uuid('Debe seleccionar un rol'),
  status: STATUS_RULE,
  password: PASSWORD_RULE.optional().or(z.literal('')),
});
export type UserForm = z.infer<typeof userSchema>;

/** En la creación la contraseña es obligatoria. */
export const createUserSchema = userSchema.extend({ password: PASSWORD_RULE });

export const resetPasswordSchema = z
  .object({
    newPassword: PASSWORD_RULE,
    confirmPassword: z.string().min(1, 'Confirme la contraseña'),
    mustChangePassword: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

// ───────────────────────────── Roles ─────────────────────────────

export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Use mayúsculas, números y guion bajo (ej. COORDINADOR)'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  status: STATUS_RULE,
  permissionIds: z.array(z.string().uuid()),
});
export type RoleForm = z.infer<typeof roleSchema>;

// ──────────────────────────── Permisos ───────────────────────────

export const permissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(80, 'Máximo 80 caracteres')
    .regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/, 'Formato requerido: modulo.accion (minúsculas)'),
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  module: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  status: STATUS_RULE,
});
export type PermissionForm = z.infer<typeof permissionSchema>;

// ──────────────────────────── Docentes ───────────────────────────

export const teacherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo se admiten letras, números y guion'),
  firstName: NAME_RULE,
  lastName: NAME_RULE,
  document: DOCUMENT_RULE,
  email: EMAIL_RULE,
  phone: PHONE_RULE,
  userId: z.string().optional().or(z.literal('')),
  subjectIds: z.array(z.string().uuid()),
  status: STATUS_RULE,
});
export type TeacherForm = z.infer<typeof teacherSchema>;

// ─────────────────────────── Asignaturas ─────────────────────────

export const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo se admiten letras, números y guion'),
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  weeklyHours: z
    .union([z.coerce.number().int('Debe ser un número entero').min(1, 'Mínimo 1 hora').max(60, 'Máximo 60 horas'), z.literal('')])
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Formato de color inválido (#RRGGBB)')
    .optional()
    .or(z.literal('')),
  status: STATUS_RULE,
});
export type SubjectForm = z.infer<typeof subjectSchema>;

// ──────────────────────────── Jornadas ───────────────────────────

export const shiftSchema = z.object({
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  status: STATUS_RULE,
});
export type ShiftForm = z.infer<typeof shiftSchema>;

// ──────────────────────────── Horarios ───────────────────────────

export const scheduleSchema = z
  .object({
    teacherId: z.string().uuid('Debe seleccionar un docente'),
    shiftId: z.string().uuid('Debe seleccionar una jornada'),
    subjectId: z.string().optional().or(z.literal('')),
    dayOfWeek: z.string(),
    checkInTime: TIME_RULE,
    checkOutTime: TIME_RULE,
    toleranceMinutes: z.coerce
      .number({ invalid_type_error: 'Ingrese un número' })
      .int('Debe ser un número entero')
      .min(0, 'No puede ser negativa')
      .max(120, 'Máximo 120 minutos'),
    status: STATUS_RULE,
  })
  .refine(
    (data) => {
      const [inH, inM] = data.checkInTime.split(':').map(Number);
      const [outH, outM] = data.checkOutTime.split(':').map(Number);
      return outH * 60 + outM > inH * 60 + inM;
    },
    { message: 'La hora de salida debe ser posterior a la de entrada', path: ['checkOutTime'] },
  );
export type ScheduleForm = z.infer<typeof scheduleSchema>;

// ─────────────────────────────── QR ──────────────────────────────

export const qrConfigSchema = z.object({
  publicUrl: z
    .string()
    .trim()
    .min(1, 'La URL es obligatoria')
    .url('Ingrese una URL válida que incluya http:// o https://')
    .max(500, 'Máximo 500 caracteres'),
  institutionName: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(160, 'Máximo 160 caracteres'),
});
export type QrConfigForm = z.infer<typeof qrConfigSchema>;

// ─────────────────────────── Configuración ───────────────────────

export const settingSchema = z.object({
  value: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
});
export type SettingForm = z.infer<typeof settingSchema>;
