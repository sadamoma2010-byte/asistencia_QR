'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<KpiTone, { icon: string; accent: string }> = {
  primary: { icon: 'bg-primary/10 text-primary', accent: 'from-indigo-500/12' },
  success: { icon: 'bg-emerald-50 text-emerald-600', accent: 'from-emerald-500/12' },
  warning: { icon: 'bg-amber-50 text-amber-600', accent: 'from-amber-500/12' },
  danger: { icon: 'bg-red-50 text-destructive', accent: 'from-red-500/12' },
  neutral: { icon: 'bg-slate-100 text-secondary', accent: 'from-slate-500/10' },
};

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  index?: number;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  index = 0,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="size-10 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-28" />
      </Card>
    );
  }

  const tokens = TONE[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
    >
      <Card className="relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-elevated">
        <div
          aria-hidden
          className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent', tokens.accent)}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </p>
            {hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>

          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tokens.icon)}>
            <Icon className="size-5" />
          </span>
        </div>
      </Card>
    </motion.div>
  );
}
