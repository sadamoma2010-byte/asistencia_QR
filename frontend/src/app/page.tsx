'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { GradientBackground } from '@/components/shared/background';
import { Logo } from '@/components/shared/logo';
import { useAuth } from '@/providers/auth-provider';

/** Punto de entrada: enruta según el estado de la sesión y el rol. */
export default function HomePage() {
  const { loading, isAuthenticated, isTeacherOnly } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) router.replace('/login');
    else router.replace(isTeacherOnly ? '/marcar' : '/dashboard');
  }, [loading, isAuthenticated, isTeacherOnly, router]);

  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <GradientBackground />
      <div className="flex flex-col items-center gap-4">
        <Logo size={56} className="animate-pulse" />
        <p className="text-sm text-muted-foreground">Cargando su sesión…</p>
      </div>
    </main>
  );
}
