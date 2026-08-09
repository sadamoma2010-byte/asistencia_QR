import { CheckCircle2, Clock, LogIn, LogOut, MinusCircle, TimerOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AttendanceStatus, AttendanceType, RecordStatus } from '@/types';

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">
      <CheckCircle2 className="size-3" />
      Activo
    </Badge>
  ) : (
    <Badge variant="secondary">
      <MinusCircle className="size-3" />
      Inactivo
    </Badge>
  );
}

const ATTENDANCE_STATUS = {
  ON_TIME: { label: 'Puntual', variant: 'success' as const, Icon: CheckCircle2 },
  LATE: { label: 'Tarde', variant: 'warning' as const, Icon: Clock },
  EARLY_DEPARTURE: { label: 'Salida anticipada', variant: 'destructive' as const, Icon: TimerOff },
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const { label, variant, Icon } = ATTENDANCE_STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function AttendanceTypeBadge({ type }: { type: AttendanceType }) {
  return type === 'CHECK_IN' ? (
    <Badge variant="default">
      <LogIn className="size-3" />
      Entrada
    </Badge>
  ) : (
    <Badge variant="outline">
      <LogOut className="size-3" />
      Salida
    </Badge>
  );
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  ON_TIME: 'Puntual',
  LATE: 'Tarde',
  EARLY_DEPARTURE: 'Salida anticipada',
};

export const ATTENDANCE_TYPE_LABEL: Record<AttendanceType, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
};
