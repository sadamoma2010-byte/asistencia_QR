'use client';

import { motion } from 'framer-motion';
import { CalendarClock, LogIn, LogOut } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { AttendanceStatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { cn, formatDate, formatTime } from '@/lib/utils';
import type { Attendance } from '@/types';

interface AttendanceHistoryProps {
  records: Attendance[];
  loading?: boolean;
  title?: string;
  showDate?: boolean;
  emptyDescription?: string;
}

/** Historial de marcaciones en formato de línea de tiempo (mobile first). */
export function AttendanceHistory({
  records,
  loading,
  title = 'Historial reciente',
  showDate = true,
  emptyDescription = 'Aún no registra marcaciones.',
}: AttendanceHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            title="Sin marcaciones"
            description={emptyDescription}
            icon={CalendarClock}
            className="py-8"
          />
        ) : (
          <ol className="space-y-1">
            {records.map((record, index) => {
              const isCheckIn = record.type === 'CHECK_IN';
              const Icon = isCheckIn ? LogIn : LogOut;

              return (
                <motion.li
                  key={record.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.24) }}
                  className="flex items-start gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
                      isCheckIn ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-secondary',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-foreground">
                        {isCheckIn ? 'Entrada' : 'Salida'}
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatTime(record.registeredAt)}
                      </span>
                      <AttendanceStatusBadge status={record.status} />
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {showDate && <>{formatDate(record.date)} · </>}
                      {record.schedule?.shift.name ?? 'Sin jornada'}
                      {record.expectedTime && <> · Esperada {record.expectedTime}</>}
                      {record.minutesDiff !== 0 && (
                        <>
                          {' '}
                          ·{' '}
                          {record.minutesDiff > 0
                            ? `${record.minutesDiff} min de retraso`
                            : `${Math.abs(record.minutesDiff)} min de anticipación`}
                        </>
                      )}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
