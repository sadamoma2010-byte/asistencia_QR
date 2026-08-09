import {
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  QrCode,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permisos que habilitan el acceso; basta con poseer uno. */
  permissions: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: 'General',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permissions: ['dashboard.read', 'reports.read'],
      },
      {
        label: 'Asistencia',
        href: '/asistencia',
        icon: ClipboardCheck,
        permissions: ['attendance.read'],
      },
      { label: 'Reportes', href: '/reportes', icon: FileBarChart, permissions: ['reports.read'] },
    ],
  },
  {
    title: 'Operación',
    items: [
      { label: 'Docentes', href: '/docentes', icon: Users, permissions: ['teachers.read'] },
      { label: 'Asignaturas', href: '/asignaturas', icon: BookOpen, permissions: ['subjects.read'] },
      { label: 'Jornadas', href: '/jornadas', icon: Sun, permissions: ['shifts.read'] },
      { label: 'Horarios', href: '/horarios', icon: CalendarClock, permissions: ['schedules.read'] },
      { label: 'Código QR', href: '/qr', icon: QrCode, permissions: ['settings.read'] },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Usuarios', href: '/usuarios', icon: UserCog, permissions: ['users.read'] },
      { label: 'Roles', href: '/roles', icon: ShieldCheck, permissions: ['roles.read'] },
      { label: 'Permisos', href: '/permisos', icon: KeyRound, permissions: ['permissions.read'] },
      { label: 'Auditoría', href: '/auditoria', icon: ScrollText, permissions: ['audit.read'] },
      {
        label: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        permissions: ['settings.read'],
      },
    ],
  },
];
