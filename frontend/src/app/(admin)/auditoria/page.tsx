'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText } from 'lucide-react';
import { useState } from 'react';

import { DetailList, FormDialog } from '@/components/forms/form-dialog';
import { AccessDenied } from '@/components/shared/auth-guard';
import { DataTable, type Column } from '@/components/shared/data-table';
import { DataToolbar, FilterSelect } from '@/components/shared/data-toolbar';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDetail, useExport, useList } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { AuditAction, AuditLog } from '@/types';

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Inactivación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  ATTENDANCE: 'Asistencia',
};

const ACTION_VARIANT: Record<
  AuditAction,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'destructive',
  ACTIVATE: 'success',
  DEACTIVATE: 'warning',
  LOGIN: 'outline',
  LOGOUT: 'secondary',
  ATTENDANCE: 'default',
};

export default function AuditPage() {
  const { can } = useAuth();
  const table = useTableState({ initialLimit: 25 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useList<AuditLog>('audit', table.queryString, can('audit.read'));
  const detail = useDetail<AuditLog>('audit', detailId);
  const exporter = useExport('audit', 'auditoria');

  const modules = useQuery({
    queryKey: ['audit', 'modules'],
    queryFn: () => api.get<string[]>('/audit/modules'),
    enabled: can('audit.read'),
    staleTime: 5 * 60_000,
  });

  if (!can('audit.read')) return <AccessDenied />;

  const columns: Column<AuditLog>[] = [
    {
      key: 'description',
      header: 'Evento',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium text-foreground">{row.description}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.userName ?? 'Sistema'} · {row.userEmail ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      sortable: true,
      cell: (row) => <Badge variant={ACTION_VARIANT[row.action]}>{ACTION_LABEL[row.action]}</Badge>,
    },
    {
      key: 'module',
      header: 'Módulo',
      sortable: true,
      cell: (row) => <Badge variant="outline">{row.module}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Fecha y hora',
      sortable: true,
      cell: (row) => <span className="text-sm">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'ipAddress',
      header: 'IP',
      hideOnMobile: true,
      cell: (row) => <span className="font-mono text-xs">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'device',
      header: 'Dispositivo',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-secondary">{row.device ?? '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Trazabilidad completa: usuario, acción, fecha, hora, IP y dispositivo (RN009)."
        icon={ScrollText}
        actions={
          can('audit.export') && (
            <Button
              variant="outline"
              loading={exporter.isPending}
              onClick={() => exporter.mutate(table.exportQueryString)}
            >
              <Download />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          )
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por descripción, usuario o módulo…"
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearFilters}
        filters={
          <>
            <Input
              type="date"
              value={table.filters.dateFrom ?? ''}
              onChange={(event) => table.setFilter('dateFrom', event.target.value)}
              className="w-full sm:w-40"
              aria-label="Fecha inicial"
            />
            <Input
              type="date"
              value={table.filters.dateTo ?? ''}
              onChange={(event) => table.setFilter('dateTo', event.target.value)}
              className="w-full sm:w-40"
              aria-label="Fecha final"
            />
            <FilterSelect
              value={table.filters.action ?? ''}
              onValueChange={(value) => table.setFilter('action', value)}
              placeholder="Acción"
              allLabel="Todas las acciones"
              options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <FilterSelect
              value={table.filters.module ?? ''}
              onValueChange={(value) => table.setFilter('module', value)}
              placeholder="Módulo"
              allLabel="Todos los módulos"
              options={(modules.data ?? []).map((module) => ({ value: module, label: module }))}
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        loading={isLoading}
        getRowId={(row) => row.id}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSortChange={table.setSort}
        onPageChange={table.setPage}
        onLimitChange={table.setLimit}
        onRowClick={(row) => setDetailId(row.id)}
        emptyTitle="Sin registros de auditoría"
        emptyDescription="No hay eventos para los criterios seleccionados."
      />

      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del evento"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && (
          <div className="space-y-5">
            <DetailList
              items={[
                { label: 'Fecha y hora', value: formatDateTime(detail.data.createdAt) },
                { label: 'Usuario', value: detail.data.userName ?? 'Sistema' },
                { label: 'Correo', value: detail.data.userEmail ?? '—' },
                {
                  label: 'Acción',
                  value: (
                    <Badge variant={ACTION_VARIANT[detail.data.action]}>
                      {ACTION_LABEL[detail.data.action]}
                    </Badge>
                  ),
                },
                { label: 'Módulo', value: detail.data.module },
                { label: 'Registro afectado', value: detail.data.entityId ?? '—' },
                { label: 'Dirección IP', value: detail.data.ipAddress ?? '—' },
                { label: 'Dispositivo', value: detail.data.device ?? '—' },
              ]}
            />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descripción
              </p>
              <p className="mt-1 text-sm">{detail.data.description}</p>
            </div>

            {detail.data.metadata && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datos adicionales
                </p>
                <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(detail.data.metadata, null, 2)}
                </pre>
              </div>
            )}

            {detail.data.userAgent && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  User agent
                </p>
                <p className="mt-1 break-all text-xs text-secondary">{detail.data.userAgent}</p>
              </div>
            )}
          </div>
        )}
      </FormDialog>
    </>
  );
}
