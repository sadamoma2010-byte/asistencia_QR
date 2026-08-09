'use client';

import { Eye, KeyRound, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RecordStatus } from '@/types';

interface RowActionsProps {
  status?: RecordStatus;
  onView?: () => void;
  onEdit?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  onResetPassword?: () => void;
  disabled?: boolean;
  /** Motivo por el que las acciones destructivas no están disponibles. */
  protectedReason?: string;
}

/** Menú de acciones por fila: ver, editar, activar/inactivar y eliminar. */
export function RowActions({
  status,
  onView,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  onResetPassword,
  disabled,
  protectedReason,
}: RowActionsProps) {
  const isActive = status === 'ACTIVE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label="Acciones">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Acciones
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {onView && (
          <DropdownMenuItem onSelect={onView}>
            <Eye />
            Ver detalle
          </DropdownMenuItem>
        )}

        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}

        {onResetPassword && (
          <DropdownMenuItem onSelect={onResetPassword}>
            <KeyRound />
            Restablecer contraseña
          </DropdownMenuItem>
        )}

        {(onActivate || onDeactivate) && status && (
          <>
            <DropdownMenuSeparator />
            {isActive
              ? onDeactivate && (
                  <DropdownMenuItem onSelect={onDeactivate}>
                    <PowerOff />
                    Inactivar
                  </DropdownMenuItem>
                )
              : onActivate && (
                  <DropdownMenuItem onSelect={onActivate}>
                    <Power />
                    Activar
                  </DropdownMenuItem>
                )}
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </>
        )}

        {protectedReason && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{protectedReason}</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
