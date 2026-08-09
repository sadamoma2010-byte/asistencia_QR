'use client';

import type { ReactNode } from 'react';

import { SidebarNav } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthGuard } from '@/components/shared/auth-guard';
import { SubtleBackground } from '@/components/shared/background';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SubtleBackground />

      <div className="flex min-h-dvh">
        {/* Navegación fija en escritorio */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card/70 backdrop-blur-sm lg:block">
          <div className="sticky top-0 h-dvh">
            <SidebarNav />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-[95rem] space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
