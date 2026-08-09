'use client';

import { KeyRound, LogOut, Menu, QrCode, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ChangePasswordDialog } from '@/components/layout/change-password-dialog';
import { SidebarNav } from '@/components/layout/sidebar';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import { NAVIGATION } from '@/lib/navigation';
import { initials } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export function Topbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const currentLabel = NAVIGATION.flatMap((section) => section.items).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.label;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu />
            </Button>

            <Logo size={28} className="lg:hidden" />

            <p className="truncate text-sm font-semibold text-foreground">
              {currentLabel ?? 'Asistencia Docente'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/marcar">
                <QrCode className="size-4" />
                Marcar asistencia
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Menú de la cuenta"
                >
                  <Avatar>
                    <AvatarFallback>{initials(user?.fullName ?? 'US')}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-xs font-medium text-primary">{user?.role.name}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/marcar">
                    <UserRound />
                    Panel docente
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                  <KeyRound />
                  Cambiar contraseña
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => void logout()}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Navegación lateral en móvil */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          hideClose
          className="inset-y-0 left-0 right-auto top-0 h-dvh max-h-dvh w-[17rem] max-w-[85vw] translate-x-0 translate-y-0 rounded-none rounded-r-2xl p-0 sm:left-0 sm:top-0 sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:rounded-r-2xl sm:p-0"
        >
          <DialogTitle className="sr-only">Navegación</DialogTitle>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
