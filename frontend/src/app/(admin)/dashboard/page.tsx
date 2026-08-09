'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlarmClock,
  CalendarCheck2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { AccessDenied } from '@/components/shared/auth-guard';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import {
  AttendanceStatusBadge,
  AttendanceTypeBadge,
} from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { DashboardData } from '@/types';

export default function DashboardPage() {
  const { can, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api.get<DashboardData>('/reports/dashboard'),
    refetchInterval: 60_000,
    enabled: can('dashboard.read', 'reports.read'),
  });

  if (!can('dashboard.read', 'reports.read')) return <AccessDenied />;

  const kpis = data?.kpis;

  return (
    <>
      <PageHeader
        title={`Bienvenido, ${user?.firstName ?? ''}`}
        description={
          data ? `Resumen operativo del ${formatDate(data.date)}` : 'Resumen operativo del día'
        }
        icon={LayoutDashboard}
        actions={
          can('reports.read') && (
            <Button variant="outline" asChild>
              <Link href="/reportes">
                <TrendingUp className="size-4" />
                Ver reportes
              </Link>
            </Button>
          )
        }
      />

      {/* ── KPIs principales ─────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total docentes"
          value={kpis?.totalTeachers ?? 0}
          hint={`${kpis?.activeTeachers ?? 0} activo(s)`}
          icon={Users}
          tone="primary"
          index={0}
          loading={isLoading}
        />
        <KpiCard
          label="Asistencias hoy"
          value={kpis?.attendancesToday ?? 0}
          hint={`${kpis?.coverageRate ?? 0}% de cobertura`}
          icon={CalendarCheck2}
          tone="success"
          index={1}
          loading={isLoading}
        />
        <KpiCard
          label="Tardanzas hoy"
          value={kpis?.lateToday ?? 0}
          hint={`${kpis?.punctualityRate ?? 0}% de puntualidad`}
          icon={AlarmClock}
          tone="warning"
          index={2}
          loading={isLoading}
        />
        <KpiCard
          label="Registros hoy"
          value={kpis?.recordsToday ?? 0}
          hint={`${kpis?.checkInsToday ?? 0} entradas · ${kpis?.checkOutsToday ?? 0} salidas`}
          icon={ClipboardList}
          tone="neutral"
          index={3}
          loading={isLoading}
        />
      </section>

      {/* ── Tendencia y pendientes ───────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Marcaciones de los últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : data ? (
              <TrendChart data={data.trend} />
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LogOut className="size-4 text-amber-600" />
                Salidas pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {kpis?.pendingCheckOut ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Docentes que registraron entrada y aún no marcan su salida.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlarmClock className="size-4 text-amber-600" />
                Mayor número de tardanzas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))
              ) : data && data.topLateTeachers.length > 0 ? (
                data.topLateTeachers.map((teacher) => (
                  <div
                    key={teacher.teacherId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{teacher.fullName}</p>
                      <p className="text-xs text-muted-foreground">{teacher.code}</p>
                    </div>
                    <Badge variant="warning">{teacher.lateCount}</Badge>
                  </div>
                ))
              ) : (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Sin tardanzas en los últimos 7 días.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Actividad reciente ───────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Actividad reciente
          </CardTitle>
          {can('attendance.read') && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/asistencia">Ver todo</Link>
            </Button>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : data && data.recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.recent.map((record) => (
                <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {record.teacher.firstName} {record.teacher.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {record.teacher.code} · {record.schedule?.shift.name ?? 'Sin jornada'} ·{' '}
                      {formatTime(record.registeredAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AttendanceTypeBadge type={record.type} />
                    <AttendanceStatusBadge status={record.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Sin actividad"
              description="Aún no se registran marcaciones en el sistema."
              icon={Activity}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
