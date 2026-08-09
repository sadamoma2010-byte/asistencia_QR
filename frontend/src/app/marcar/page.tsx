'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  Power,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AttendanceHistory } from '@/components/attendance/attendance-history';
import { AuthGuard } from '@/components/shared/auth-guard';
import { GradientBackground } from '@/components/shared/background';
import { Logo } from '@/components/shared/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Attendance, AttendanceType, Paginated, SelfAttendanceStatus } from '@/types';

export default function MarcarPage() {
  return (
    <AuthGuard>
      <TeacherPanel />
    </AuthGuard>
  );
}

function TeacherPanel() {
  const { user, logout, can } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ type: AttendanceType; message: string } | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusQuery = useQuery({
    queryKey: ['attendance', 'me', 'status'],
    queryFn: () => api.get<SelfAttendanceStatus>('/attendance/me/status'),
    refetchOnWindowFocus: true,
  });

  const historyQuery = useQuery({
    queryKey: ['attendance', 'me', 'history'],
    queryFn: () => api.get<Paginated<Attendance>>('/attendance/me/history?limit=8&page=1'),
  });

  const register = useMutation({
    mutationFn: (type: AttendanceType) =>
      api.post<Attendance & { message: string }>('/attendance/register', { type }),
    onSuccess: (record) => {
      setFeedback({ type: record.type, message: record.message });
      toast.success(record.message);
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.detail : 'No fue posible registrar la marcación';
      toast.error(message);
      setFeedback(null);
    },
  });

  const status = statusQuery.data;
  const loading = statusQuery.isLoading;

  // Un usuario sin vínculo docente no puede usar este panel
  const unlinked = statusQuery.error instanceof ApiError && statusQuery.error.statusCode === 403;

  return (
    <main className="relative min-h-dvh px-4 pb-12 pt-6 sm:px-6">
      <GradientBackground />

      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* ── Cabecera ─────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                Asistencia Docente
              </p>
              <p className="text-xs text-muted-foreground">Registro por QR institucional</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {can('dashboard.read') && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                Panel
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => void logout()} aria-label="Cerrar sesión">
              <Power />
            </Button>
          </div>
        </header>

        {/* ── Saludo y reloj ───────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card rounded-2xl p-6 text-center sm:p-8"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Hola {user?.firstName}
          </h1>

          <p className="mt-1.5 text-sm text-secondary">
            {status?.dayName ? `${status.dayName}, ` : ''}
            {new Intl.DateTimeFormat('es-CO', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(clock)}
          </p>

          <p className="mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight text-primary sm:text-5xl">
            {new Intl.DateTimeFormat('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            }).format(clock)}
          </p>

          {status?.teacher && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline">{status.teacher.code}</Badge>
              {status.schedules.map((schedule) => (
                <Badge key={schedule.id} variant="default">
                  <Clock className="size-3" />
                  {schedule.shift.name} · {schedule.checkInTime}–{schedule.checkOutTime}
                </Badge>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Estado bloqueante ────────────────────────────── */}
        {unlinked && (
          <Alert
            tone="warning"
            title="Su usuario no está vinculado a un docente"
            description="Solicite al administrador que asocie su cuenta con su ficha docente para poder registrar asistencia."
          />
        )}

        {status?.blockedReason && (
          <Alert tone="warning" title="Registro no disponible" description={status.blockedReason} />
        )}

        {/* ── Confirmación de la marcación ─────────────────── */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="border-success/30 bg-emerald-50/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-900">
                      {feedback.type === 'CHECK_IN' ? 'Entrada registrada' : 'Salida registrada'}
                    </p>
                    <p className="text-sm text-emerald-800">{feedback.message}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pregunta y botones grandes ───────────────────── */}
        {!unlinked && (
          <section className="space-y-4">
            <h2 className="text-center text-base font-medium text-secondary">
              ¿Qué deseas registrar?
            </h2>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <BigActionButton
                  icon={LogIn}
                  label="Registrar Entrada"
                  hint={
                    status?.schedules[0]
                      ? `Hora esperada: ${status.schedules[0].checkInTime}`
                      : 'Sin horario asignado'
                  }
                  tone="primary"
                  disabled={!status?.canCheckIn || register.isPending}
                  loading={register.isPending && register.variables === 'CHECK_IN'}
                  onClick={() => register.mutate('CHECK_IN')}
                />

                <BigActionButton
                  icon={LogOut}
                  label="Registrar Salida"
                  hint={
                    status?.schedules[0]
                      ? `Hora esperada: ${status.schedules[0].checkOutTime}`
                      : 'Sin horario asignado'
                  }
                  tone="success"
                  disabled={!status?.canCheckOut || register.isPending}
                  loading={register.isPending && register.variables === 'CHECK_OUT'}
                  onClick={() => register.mutate('CHECK_OUT')}
                />
              </div>
            )}

            {status && !status.canCheckIn && !status.canCheckOut && !status.blockedReason && (
              <p className="text-center text-sm text-muted-foreground">
                Ya completó su jornada de hoy. ¡Buen trabajo!
              </p>
            )}
          </section>
        )}

        {/* ── Marcaciones de hoy ───────────────────────────── */}
        {status && status.todayRecords.length > 0 && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <p className="text-sm font-semibold">Marcaciones de hoy</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {status.todayRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
                  >
                    <span className="text-sm font-medium">
                      {record.type === 'CHECK_IN' ? 'Entrada' : 'Salida'}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-secondary">
                      {new Intl.DateTimeFormat('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }).format(new Date(record.registeredAt))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Historial ────────────────────────────────────── */}
        <AttendanceHistory
          records={historyQuery.data?.items ?? []}
          loading={historyQuery.isLoading}
          emptyDescription="Cuando registre su primera entrada aparecerá aquí."
        />
      </div>
    </main>
  );
}

// ───────────────────────── Botón de acción ───────────────────────

interface BigActionButtonProps {
  icon: typeof LogIn;
  label: string;
  hint: string;
  tone: 'primary' | 'success';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function BigActionButton({
  icon: Icon,
  label,
  hint,
  tone,
  disabled,
  loading,
  onClick,
}: BigActionButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      whileHover={disabled ? undefined : { y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl px-5 py-6 text-center',
        'shadow-card transition-shadow duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-soft',
        tone === 'primary'
          ? 'bg-primary text-primary-foreground enabled:hover:shadow-glow'
          : 'bg-success text-success-foreground enabled:hover:shadow-elevated',
      )}
    >
      <Icon className={cn('size-7', loading && 'animate-pulse')} />
      <span className="text-base font-semibold sm:text-lg">{loading ? 'Registrando…' : label}</span>
      <span className="text-xs font-medium opacity-85">{hint}</span>
    </motion.button>
  );
}

// ──────────────────────────── Avisos ─────────────────────────────

function Alert({
  tone,
  title,
  description,
}: {
  tone: 'warning' | 'danger';
  title: string;
  description: string;
}) {
  return (
    <Card
      className={cn(
        tone === 'warning' ? 'border-warning/30 bg-amber-50/80' : 'border-destructive/30 bg-red-50/80',
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle
          className={cn('mt-0.5 size-5 shrink-0', tone === 'warning' ? 'text-amber-600' : 'text-destructive')}
        />
        <div className="min-w-0">
          <p className={cn('font-semibold', tone === 'warning' ? 'text-amber-900' : 'text-red-900')}>
            {title}
          </p>
          <p className={cn('text-sm', tone === 'warning' ? 'text-amber-800' : 'text-red-800')}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
