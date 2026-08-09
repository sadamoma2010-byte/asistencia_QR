'use client';

import { ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';

interface AuthGuardProps {
  children: ReactNode;
  /** Permisos requeridos; basta con poseer uno de ellos. */
  permissions?: string[];
}

/** Protege una ruta: exige sesión activa y, opcionalmente, permisos RBAC. */
export function AuthGuard({ children, permissions = [] }: AuthGuardProps) {
  const { loading, isAuthenticated, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Logo size={48} className="animate-pulse" />
          <p className="text-sm text-muted-foreground">Verificando su sesión…</p>
        </div>
      </div>
    );
  }

  if (permissions.length > 0 && !can(...permissions)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

export function AccessDenied() {
  const router = useRouter();

  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert className="size-6" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Acceso restringido</h2>
            <p className="text-sm text-muted-foreground text-balance">
              Su rol no cuenta con los permisos necesarios para consultar esta sección. Si considera
              que se trata de un error, comuníquese con el administrador.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            Volver
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
