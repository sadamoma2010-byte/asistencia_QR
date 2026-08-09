'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileBarChart, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { FormDialog } from '@/components/forms/form-dialog';
import { FormField } from '@/components/forms/form-field';
import { AccessDenied } from '@/components/shared/auth-guard';
import { DataTable, type Column } from '@/components/shared/data-table';
import { DataToolbar, FilterSelect } from '@/components/shared/data-toolbar';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/misc';
import { useExport, useOptions } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { ApiError, api } from '@/lib/api';
import { cn, monthStartKey, todayKey } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Option, Paginated, TeacherReportRow } from '@/types';

export default function ReportsPage() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const table = useTableState({
    initialLimit: 25,
    initialFilters: { dateFrom: monthStartKey(), dateTo: todayKey() },
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');

  const teachers = useOptions<Option>('teachers', 'options', can('reports.read'));
  const shifts = useOptions<Option>('shifts', 'options', can('reports.read'));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'attendance', table.queryString],
    queryFn: () => api.get<Paginated<TeacherReportRow>>(`/reports/attendance${table.queryString}`),
    enabled: can('reports.read'),
    placeholderData: (previous) => previous,
  });

  const exportSummary = useExport('reports', 'reporte_asistencia');
  const exportDetail = useExport('reports', 'detalle_asistencia', 'export/detail');

  // Igual que en Asistencia: eliminar marcaciones es exclusivo del SUPER_ADMIN
  const canDelete = user?.role.name === 'SUPER_ADMIN';

  const selectedRows = (data?.items ?? []).filter((row) => selected.includes(row.teacherId));
  const affectedRecords = selectedRows.reduce((sum, row) => sum + row.totalRecords, 0);

  const deleteByTeacher = useMutation({
    mutationFn: () =>
      api.post<{ deleted: number; message: string }>('/attendance/delete-by-teacher', {
        teacherIds: selected,
        dateFrom: table.filters.dateFrom || undefined,
        dateTo: table.filters.dateTo || undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      setSelected([]);
      setDeleteOpen(false);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible eliminar las marcaciones',
      ),
  });

  if (!can('reports.read')) return <AccessDenied />;

  const teacherLabel = (teacher: Option) =>
    `${teacher.lastName ?? ''} ${teacher.firstName ?? ''}`.trim() + ` · ${teacher.code ?? ''}`;

  const totals = (data?.items ?? []).reduce(
    (accumulator, row) => ({
      records: accumulator.records + row.totalRecords,
      onTime: accumulator.onTime + row.onTime,
      late: accumulator.late + row.late,
      lateMinutes: accumulator.lateMinutes + row.totalLateMinutes,
    }),
    { records: 0, onTime: 0, late: 0, lateMinutes: 0 },
  );

  const columns: Column<TeacherReportRow>[] = [
    {
      key: 'fullName',
      header: 'Docente',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.code} · {row.document}
          </p>
        </div>
      ),
    },
    {
      key: 'shifts',
      header: 'Jornada(s)',
      cell: (row) => <span className="text-sm">{row.shifts}</span>,
    },
    { key: 'totalRecords', header: 'Registros', cell: (row) => row.totalRecords },
    { key: 'checkIns', header: 'Entradas', hideOnMobile: true, cell: (row) => row.checkIns },
    { key: 'checkOuts', header: 'Salidas', hideOnMobile: true, cell: (row) => row.checkOuts },
    {
      key: 'onTime',
      header: 'Puntuales',
      cell: (row) => <Badge variant="success">{row.onTime}</Badge>,
    },
    {
      key: 'late',
      header: 'Tardanzas',
      cell: (row) =>
        row.late > 0 ? <Badge variant="warning">{row.late}</Badge> : <Badge variant="outline">0</Badge>,
    },
    {
      key: 'totalLateMinutes',
      header: 'Min. retraso',
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{row.totalLateMinutes}</span>,
    },
    {
      key: 'punctualityRate',
      header: '% Puntualidad',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                row.punctualityRate >= 90
                  ? 'bg-success'
                  : row.punctualityRate >= 70
                    ? 'bg-warning'
                    : 'bg-destructive',
              )}
              style={{ width: `${row.punctualityRate}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums">{row.punctualityRate}%</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Consolidado de asistencia por docente con exportación a Excel."
        icon={FileBarChart}
        actions={
          can('reports.export') && (
            <>
              <Button
                variant="outline"
                loading={exportDetail.isPending}
                onClick={() => exportDetail.mutate(table.exportQueryString)}
              >
                <FileSpreadsheet />
                <span className="hidden sm:inline">Detalle</span>
              </Button>
              <Button
                loading={exportSummary.isPending}
                onClick={() => exportSummary.mutate(table.exportQueryString)}
              >
                <Download />
                Exportar Excel
              </Button>
            </>
          )
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar docente…"
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
              value={table.filters.teacherId ?? ''}
              onValueChange={(value) => table.setFilter('teacherId', value)}
              placeholder="Docente"
              allLabel="Todos los docentes"
              options={(teachers.data ?? []).map((teacher) => ({
                value: teacher.id,
                label: teacherLabel(teacher),
              }))}
            />
            <FilterSelect
              value={table.filters.shiftId ?? ''}
              onValueChange={(value) => table.setFilter('shiftId', value)}
              placeholder="Jornada"
              allLabel="Todas las jornadas"
              options={(shifts.data ?? []).map((shift) => ({
                value: shift.id,
                label: shift.name ?? '',
              }))}
            />
            <FilterSelect
              value={table.filters.status ?? ''}
              onValueChange={(value) => table.setFilter('status', value)}
              placeholder="Estado"
              allLabel="Todos los estados"
              options={[
                { value: 'ON_TIME', label: 'Puntual' },
                { value: 'LATE', label: 'Tarde' },
                { value: 'EARLY_DEPARTURE', label: 'Salida anticipada' },
              ]}
            />
          </>
        }
      />

      {/* ── Totales del periodo ──────────────────────────────── */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:p-5 lg:grid-cols-4">
          <Summary label="Docentes en el periodo" value={data?.meta.total ?? 0} />
          <Summary label="Marcaciones" value={totals.records} />
          <Summary label="Tardanzas" value={totals.late} tone="warning" />
          <Summary label="Minutos de retraso" value={totals.lateMinutes} tone="danger" />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        loading={isLoading}
        getRowId={(row) => row.teacherId}
        onPageChange={table.setPage}
        onLimitChange={table.setLimit}
        emptyTitle="Sin datos en el periodo"
        emptyDescription="Ajuste el rango de fechas o los filtros para ver resultados."
        selected={canDelete ? selected : undefined}
        onSelectedChange={canDelete ? setSelected : undefined}
        selectionActions={() => (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Eliminar marcaciones del periodo
          </Button>
        )}
      />

      {/* ── Confirmación de eliminación ──────────────────────── */}
      <FormDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setReason('');
        }}
        title="Eliminar marcaciones del periodo"
        description="Se eliminarán todas las marcaciones de los docentes seleccionados dentro del rango de fechas activo."
        submitLabel="Sí, eliminar"
        cancelLabel="No, cancelar"
        loading={deleteByTeacher.isPending}
        onSubmit={() => deleteByTeacher.mutate()}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-red-900">
                Se eliminarán {affectedRecords} marcación(es) de {selectedRows.length} docente(s)
              </p>
              <p className="mt-0.5 text-red-800">
                Periodo: {table.filters.dateFrom || 'sin fecha inicial'} a{' '}
                {table.filters.dateTo || 'sin fecha final'}. La acción quedará registrada en la
                auditoría con su nombre.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Docentes seleccionados</p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {selectedRows.map((row) => (
                <div
                  key={row.teacherId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{row.fullName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.code}</span>
                  </span>
                  <Badge variant="destructive">{row.totalRecords} marcación(es)</Badge>
                </div>
              ))}
            </div>
          </div>

          <FormField
            label="Motivo"
            hint="Opcional, pero recomendable: queda guardado en la auditoría junto a su nombre."
          >
            {(field) => (
              <Textarea
                {...field}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Ej. Corrección del periodo por error de configuración horaria"
              />
            )}
          </FormField>
        </div>
      </FormDialog>
    </>
  );
}

function Summary({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'warning' && 'text-amber-600',
          tone === 'danger' && 'text-destructive',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
