'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/shared/logo';
import { NAVIGATION } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

/** Navegación lateral filtrada por los permisos del usuario (RBAC). */
export function SidebarNav({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { can, user } = useAuth();

  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(...item.permissions)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            Asistencia Docente
          </p>
          <p className="truncate text-xs text-muted-foreground">Control por QR</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                        'transition-colors duration-200',
                        active
                          ? 'text-primary'
                          : 'text-secondary hover:bg-accent hover:text-foreground',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <item.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="truncate text-xs font-medium text-foreground">{user?.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.role.name}</p>
      </div>
    </div>
  );
}
