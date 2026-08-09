'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox, Skeleton } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import type { PaginationMeta } from '@/types';

export interface Column<T> {
  /** Clave del campo; se usa para el ordenamiento server side. */
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  /** Se muestra como título de la tarjeta en móvil. */
  primary?: boolean;
  /** Se omite en la vista de tarjetas móvil. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  meta?: PaginationMeta;
  loading?: boolean;
  getRowId: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  /**
   * Identificadores seleccionados. Al pasarlo se habilitan las casillas
   * de verificación en cada fila y en el encabezado.
   */
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Acciones que operan sobre la selección (por ejemplo, eliminar). */
  selectionActions?: (selectedIds: string[]) => ReactNode;
}

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Tabla profesional con paginación, búsqueda y ordenamiento **server side**.
 * En escritorio renderiza una tabla; en móvil, tarjetas responsive
 * (nunca depende del scroll horizontal para ser usable).
 */
export function DataTable<T>({
  columns,
  data,
  meta,
  loading = false,
  getRowId,
  rowActions,
  onRowClick,
  sortBy,
  sortOrder = 'desc',
  onSortChange,
  onPageChange,
  onLimitChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selected,
  onSelectedChange,
  selectionActions,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;
    const nextOrder = sortBy === column.key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(column.key, nextOrder);
  };

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const detailColumns = columns.filter((c) => c !== primaryColumn && !c.hideOnMobile);

  // La selección solo se activa cuando quien usa la tabla la provee
  const selectable = Boolean(selected && onSelectedChange);
  const selectedIds = selected ?? [];
  const pageIds = data.map((row) => getRowId(row));
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.includes(id));

  const toggleRow = (id: string) => {
    onSelectedChange?.(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  const togglePage = () => {
    onSelectedChange?.(
      allOnPageSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  if (loading) return <TableSkeleton columns={columns.length} />;

  if (data.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Barra de selección ──────────────────────────────── */}
      <AnimatePresence>
        {selectable && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">
                <span className="tabular-nums">{selectedIds.length}</span> registro(s)
                seleccionado(s)
                <button
                  type="button"
                  onClick={() => onSelectedChange?.([])}
                  className="ml-3 text-sm font-normal text-primary underline-offset-2 hover:underline"
                >
                  Limpiar selección
                </button>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {selectionActions?.(selectedIds)}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Escritorio: DataTable ───────────────────────────── */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={togglePage}
                    aria-label="Seleccionar todos los de esta página"
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.key} className={column.headerClassName}>
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      {column.header}
                      {sortBy === column.key ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-16 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            <AnimatePresence initial={false}>
              {data.map((row, index) => (
                <motion.tr
                  key={getRowId(row)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.16) }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-accent/60',
                    onRowClick && 'cursor-pointer',
                    selectedIds.includes(getRowId(row)) && 'bg-primary/5',
                  )}
                >
                  {selectable && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(getRowId(row))}
                        onCheckedChange={() => toggleRow(getRowId(row))}
                        aria-label="Seleccionar registro"
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {rowActions(row)}
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </Card>

      {/* ── Móvil: tarjetas responsive ──────────────────────── */}
      <div className="space-y-3 md:hidden">
        {data.map((row, index) => (
          <motion.div
            key={getRowId(row)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2) }}
          >
            <Card
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'p-4 transition-shadow active:scale-[0.995]',
                onRowClick && 'cursor-pointer hover:shadow-elevated',
                selectedIds.includes(getRowId(row)) && 'border-primary/40 bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                {selectable && (
                  <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(getRowId(row))}
                      onCheckedChange={() => toggleRow(getRowId(row))}
                      aria-label="Seleccionar registro"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 font-medium text-foreground">
                  {primaryColumn.cell(row)}
                </div>
                {rowActions && (
                  <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    {rowActions(row)}
                  </div>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                {detailColumns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {column.header}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </motion.div>
        ))}
      </div>

      {meta && (
        <Pagination meta={meta} onPageChange={onPageChange} onLimitChange={onLimitChange} />
      )}
    </div>
  );
}

// ─────────────────────────── Paginación ──────────────────────────

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({ meta, onPageChange, onLimitChange }: PaginationProps) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Mostrando <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> de{' '}
        <span className="font-medium text-foreground">{meta.total}</span> registro(s)
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-4">
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">Por página</span>
            <Select
              value={String(meta.limit)}
              onValueChange={(value) => onLimitChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-[4.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange?.(meta.page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange?.(meta.page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Esqueleto ───────────────────────────

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-3">
      <Card className="hidden overflow-hidden md:block">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
            {Array.from({ length: columns }).map((_, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </Card>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
