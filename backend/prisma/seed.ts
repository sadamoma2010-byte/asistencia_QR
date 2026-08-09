/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { RecordStatus, SettingType } from '../src/common/enums';

const prisma = new PrismaClient();

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@datly.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';

// ─────────────────────────── Permisos ───────────────────────────

type PermissionSeed = { code: string; name: string; module: string };

const CRUD_MODULES: { key: string; label: string; actions: string[] }[] = [
  { key: 'users', label: 'Usuarios', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export', 'reset-password'] },
  { key: 'roles', label: 'Roles', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  { key: 'permissions', label: 'Permisos', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  { key: 'teachers', label: 'Docentes', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  { key: 'subjects', label: 'Asignaturas', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  { key: 'shifts', label: 'Jornadas', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  { key: 'schedules', label: 'Horarios', actions: ['read', 'create', 'update', 'delete', 'activate', 'deactivate', 'export'] },
  // `attendance.delete` queda además restringido al SUPER_ADMIN por RolesGuard
  { key: 'attendance', label: 'Asistencia', actions: ['read', 'create', 'export', 'self', 'delete'] },
  { key: 'reports', label: 'Reportes', actions: ['read', 'export'] },
  { key: 'audit', label: 'Auditoría', actions: ['read', 'export'] },
  { key: 'settings', label: 'Configuración', actions: ['read', 'update'] },
  { key: 'dashboard', label: 'Dashboard', actions: ['read'] },
];

const ACTION_LABEL: Record<string, string> = {
  read: 'Consultar',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  activate: 'Activar',
  deactivate: 'Inactivar',
  export: 'Exportar',
  self: 'Registrar propia asistencia',
  'reset-password': 'Restablecer contraseña',
};

const PERMISSIONS: PermissionSeed[] = CRUD_MODULES.flatMap((m) =>
  m.actions.map((action) => ({
    code: `${m.key}.${action}`,
    name: `${ACTION_LABEL[action]} ${m.label.toLowerCase()}`,
    module: m.label,
  })),
);

// ──────────────────────────── Roles ─────────────────────────────

const ROLES: { name: string; description: string; permissions: (codes: string[]) => string[] }[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Control total del sistema. Acceso irrestricto a todos los módulos.',
    permissions: (codes) => codes,
  },
  {
    name: 'ADMINISTRADOR',
    description: 'Gestión operativa completa. No administra el catálogo de permisos.',
    permissions: (codes) =>
      codes
        .filter((c) => !c.startsWith('permissions.') || c === 'permissions.read')
        // `attendance.delete` queda solo para el SUPER_ADMIN: las marcaciones son
        // la evidencia del sistema y su borrado no debe delegarse.
        .filter(
          (c) => c !== 'roles.delete' && c !== 'attendance.self' && c !== 'attendance.delete',
        ),
  },
  {
    name: 'COORDINADOR',
    description: 'Supervisa docentes, horarios, asistencia y reportes. Sin gestión de usuarios.',
    permissions: () => [
      'dashboard.read',
      'teachers.read',
      'teachers.update',
      'teachers.export',
      'subjects.read',
      'subjects.create',
      'subjects.update',
      'subjects.export',
      'shifts.read',
      'schedules.read',
      'schedules.create',
      'schedules.update',
      'schedules.export',
      'attendance.read',
      'attendance.create',
      'attendance.export',
      'reports.read',
      'reports.export',
      'audit.read',
    ],
  },
  {
    name: 'DOCENTE',
    description: 'Registra su propia entrada y salida y consulta su historial.',
    permissions: () => ['attendance.self'],
  },
];

// ────────────────────────── Configuración ───────────────────────

const SETTINGS: {
  key: string;
  value: string;
  type: SettingType;
  group: string;
  label: string;
  description: string;
  isPublic: boolean;
  isSystem?: boolean;
}[] = [
  {
    key: 'qr.public_url',
    value: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/marcar`,
    type: SettingType.STRING,
    group: 'qr',
    label: 'URL pública del QR institucional',
    description: 'Destino al que apunta el código QR único de la institución.',
    isPublic: true,
  },
  {
    key: 'qr.institution_name',
    value: 'Institución Educativa',
    type: SettingType.STRING,
    group: 'qr',
    label: 'Nombre institucional',
    description: 'Se muestra bajo el código QR al descargarlo.',
    isPublic: true,
  },
  {
    key: 'attendance.default_tolerance_minutes',
    value: '10',
    type: SettingType.NUMBER,
    group: 'attendance',
    label: 'Tolerancia por defecto (minutos)',
    description: 'Se aplica a los horarios que no definen una tolerancia propia.',
    isPublic: false,
  },
  {
    key: 'attendance.window_minutes',
    value: '180',
    type: SettingType.NUMBER,
    group: 'attendance',
    label: 'Ventana de marcación (minutos)',
    description: 'Margen máximo respecto a la hora del horario para aceptar una marcación.',
    isPublic: false,
  },
  {
    key: 'app.timezone',
    value: process.env.APP_TIMEZONE ?? 'America/Bogota',
    type: SettingType.STRING,
    group: 'general',
    label: 'Zona horaria institucional',
    description: 'Determina el cálculo de puntualidad y el corte de día.',
    isPublic: true,
    isSystem: true,
  },
  {
    key: 'app.institution_short_name',
    value: 'Asistencia Docente',
    type: SettingType.STRING,
    group: 'general',
    label: 'Nombre corto institucional',
    description: 'Se muestra en la cabecera de la aplicación.',
    isPublic: true,
  },
];

// ─────────────────────────── Ejecución ──────────────────────────

async function main() {
  console.log('🌱  Iniciando seed…\n');

  // 1. Permisos
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module, isSystem: true, deletedAt: null },
      create: { ...p, isSystem: true, status: RecordStatus.ACTIVE },
    });
  }
  console.log(`✓ Permisos sincronizados: ${PERMISSIONS.length}`);

  const allPermissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p.id]));
  const allCodes = allPermissions.map((p) => p.code);

  // 2. Roles + asignación de permisos
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, isSystem: true, deletedAt: null },
      create: {
        name: r.name,
        description: r.description,
        isSystem: true,
        status: RecordStatus.ACTIVE,
      },
    });

    const codes = r.permissions(allCodes);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      // SQLite no admite `skipDuplicates`; el deleteMany previo evita colisiones
      data: codes
        .map((code) => permissionByCode.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });

    console.log(`✓ Rol ${r.name.padEnd(14)} → ${codes.length} permisos`);
  }

  // 3. Usuario inicial SUPER_ADMIN
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, ROUNDS);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: superAdminRole.id, status: RecordStatus.ACTIVE, deletedAt: null },
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      document: '1000000000',
      email: ADMIN_EMAIL,
      phone: null,
      password: hashed,
      status: RecordStatus.ACTIVE,
      roleId: superAdminRole.id,
    },
  });
  console.log(`\n✓ Usuario inicial: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (SUPER_ADMIN)`);

  // 4. Configuración
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { label: s.label, description: s.description, group: s.group, type: s.type, isPublic: s.isPublic },
      create: { ...s, isSystem: s.isSystem ?? false },
    });
  }
  console.log(`✓ Configuración sincronizada: ${SETTINGS.length} claves`);

  // 5. Jornadas base
  const shifts = [
    { name: 'Mañana', description: 'Jornada de la mañana' },
    { name: 'Tarde', description: 'Jornada de la tarde' },
    { name: 'Noche', description: 'Jornada nocturna' },
  ];
  for (const s of shifts) {
    await prisma.shift.upsert({
      where: { name: s.name },
      update: { description: s.description, deletedAt: null },
      create: { ...s, status: RecordStatus.ACTIVE },
    });
  }
  console.log(`✓ Jornadas base: ${shifts.map((s) => s.name).join(', ')}`);

  // 6. Asignaturas de ejemplo
  const subjects = [
    { code: 'MAT-101', name: 'Matemáticas', weeklyHours: 6, color: '#4F46E5' },
    { code: 'LEN-201', name: 'Lengua Castellana', weeklyHours: 5, color: '#0EA5E9' },
    { code: 'CNA-110', name: 'Ciencias Naturales', weeklyHours: 4, color: '#10B981' },
    { code: 'SOC-120', name: 'Ciencias Sociales', weeklyHours: 4, color: '#F59E0B' },
    { code: 'TEC-305', name: 'Tecnología e Informática', weeklyHours: 3, color: '#8B5CF6' },
    { code: 'EFI-140', name: 'Educación Física', weeklyHours: 2, color: '#EF4444' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, weeklyHours: s.weeklyHours, color: s.color, deletedAt: null },
      create: { ...s, status: RecordStatus.ACTIVE },
    });
  }
  console.log(`✓ Asignaturas de ejemplo: ${subjects.length}`);

  console.log('\n🌱  Seed completado.\n');
}

main()
  .catch((e) => {
    console.error('✗ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
