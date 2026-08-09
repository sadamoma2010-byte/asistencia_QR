'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface TrendPoint {
  date: string;
  onTime: number;
  late: number;
  total: number;
}

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Barras apiladas de los últimos 7 días: puntuales vs. tardanzas.
 * Se dibuja con CSS puro para evitar dependencias de graficación.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((point) => point.total));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          Puntuales
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning" />
          Tardanzas
        </span>
      </div>

      {/* `items-stretch` (por defecto) es necesario: con `items-end` las columnas
          se encogen al alto del contenido y el envoltorio de la barra queda en 0. */}
      <div className="flex h-44 gap-1.5 sm:gap-3">
        {data.map((point, index) => {
          const date = new Date(`${point.date}T00:00:00`);
          const heightPercent = (point.total / max) * 100;
          const latePercent = point.total > 0 ? (point.late / point.total) * 100 : 0;

          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPercent, point.total > 0 ? 6 : 2)}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-t-md',
                    point.total > 0 ? 'bg-primary' : 'bg-slate-200',
                  )}
                  title={`${point.total} registro(s) · ${point.late} tardanza(s)`}
                >
                  {point.late > 0 && (
                    <span
                      className="absolute inset-x-0 top-0 bg-warning"
                      style={{ height: `${latePercent}%` }}
                    />
                  )}
                </motion.div>
              </div>

              <div className="text-center">
                <p className="text-[11px] font-medium text-foreground">
                  {DAY_SHORT[date.getDay()]}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">{point.total}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
