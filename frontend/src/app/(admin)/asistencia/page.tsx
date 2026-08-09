'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Download, LogIn, LogOut, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DetailList, FormDialog } from '@/components/forms/form-dialog';
import { FormField } from '@/components/forms/form-field';
import { AccessDenied } from '@/components/shared/auth-guard';
import { DataTable, type Column } from '@/components/shared/data-table';
import { DataToolbar, FilterSelect } from '@/components/shared/data-toolbar';
import { PageHeader } from '@/components/shared/page-header';
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_TYPE_LABEL,
  AttendanceStatusBadge,
  AttendanceTypeBadge,
} from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDetail, useExport, useList, useOptions } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { ApiError, api } from '@/lib/api';
import { formatDate, formatDateTime, formatTime, todayKey } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Attendance, AttendanceType, Option } from '@/types';

export default function AttendancePage() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const table = useTableState({
    initialSortBy: 'registeredAt',
    initialFilters: { dateFrom: todayKey(), dateTo: todayKey() },
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [manual, setManual] = useState<{ teacherId: string; type: AttendanceType; notes: string }>({
    teacherId: '',
    type: 'CHECK_IN',
    notes: '',
  });

  const { data, isLoading } = useList<Attendance>(
    'attendance',
    table.queryString,
    can('attendance.read'),
  );
  const detail = useDetail<Attendance>('attendance', detailId);
  const teachers = useOptions<Option>('teachers', 'options', can('attendance.read'));
  const shifts = useOptions<Option>('shifts', 'options', can('attendance.read'));
  const exporter = useExport('attendance', 'asistencia');

  const register = useMutation({
    mutationFn: () =>
      api.post<Attendance & { message: string }>('/attendance/register', {
        type: manual.type,
        teacherId: manual.teacherId,
        notes: manual.notes || undefined,
      }),
    onSuccess: (record) => {
      toast.success(record.message);
      setRegisterOpen(false);
      setManual({ teacherId: '', type: 'CHECK_IN', notes: '' });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible registrar la marcación',
      ),
  });

  // El borrado de marcaciones queda reservado al SUPER_ADMIN: son la
  // evidencia del sistema y el backend lo verifica de nuevo con RolesGuard.
  const canDelete = user?.role.name === 'SUPER_ADMIN';

  const bulkDelete = useMutation({
    mutationFn: () =>
      api.post<{ deleted: number; message: string }>('/attendance/bulk-delete', {
        ids: selected,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      setSelected([]);
      setDeleteOpen(false);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible eliminar las marcaciones',
      ),
  });

  if (!can('attendance.read')) return <AccessDenied />;

  const teacherLabel = (teacher: Option) =>
    `${teacher.lastName ?? ''} ${teacher.firstName ?? ''}`.trim() + ` · ${teacher.code ?? ''}`;

  const columns: Column<Attendance>[] = [
    {
      key: 'teacher',
      header: 'Docente',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.teacher.firstName} {row.teacher.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.teacher.code} · {row.teacher.document}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      cell: (row) => <span className="text-sm">{formatDate(row.date)}</span>,
    },
    {
      key: 'registeredAt',
      header: 'Hora',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-sm tabular-nums">{formatTime(row.registeredAt)}</span>
      ),
    },
    { key: 'type', header: 'Tipo', sortable: true, cell: (row) => <AttendanceTypeBadge type={row.type} /> },
    {
      key: 'shift',
      header: 'Jornada',
      cell: (row) => (
        <span className="text-sm">{row.schedule?.shift.name ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      key: 'expectedTime',
      header: 'Esperada',
      hideOnMobile: true,
      cell: (row) => <span className="font-mono text-sm tabular-nums">{row.expectedTime ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (row) => <AttendanceStatusBadge status={row.status} />,
    },
    {
      key: 'minutesDiff',
      header: 'Diferencia',
      sortable: true,
      cell: (row) =>
        row.minutesDiff === 0 ? (
          <span className="text-sm text-muted-foreground">A tiempo</span>
        ) : (
          <span
            className={`text-sm font-medium tabular-nums ${row.minutesDiff > 0 ? 'text-amber-600' : 'text-primary'}`}
          >
            {row.minutesDiff > 0 ? '+' : ''}
            {row.minutesDiff} min
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Asistencia"
        description="Consulte, filtre y exporte las marcaciones registradas. Los registros no se eliminan."
        icon={ClipboardCheck}
        actions={
          <>
            {can('attendance.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('attendance.create') && (
              <Button onClick={() => setRegisterOpen(true)}>
                <Plus />
                Registrar marcación
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por docente, código o documento…"
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
              value={table.filters.type ?? ''}
              onValueChange={(value) => table.setFilter('type', value)}
              placeholder="Tipo"
              allLabel="Entradas y salidas"
              options={[
                { value: 'CHECK_IN', label: 'Entradas' },
                { value: 'CHECK_OUT', label: 'Salidas' },
              ]}
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
        emptyTitle="Sin marcaciones"
        emptyDescription="No hay registros para el periodo y los filtros seleccionados."
        selected={canDelete ? selected : undefined}
        onSelectedChange={canDelete ? setSelected : undefined}
        selectionActions={() => (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Eliminar seleccionadas
          </Button>
        )}
      />

      {/* ── Registro manual ──────────────────────────────────── */}
      <FormDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        title="Registrar marcación"
        description="El registro aplica las mismas reglas de negocio que el QR (RN001 a RN009)."
        submitLabel="Registrar"
        loading={register.isPending}
        onSubmit={() => {
          if (!manual.teacherId) {
            toast.error('Seleccione el docente a registrar');
            return;
          }
          register.mutate();
        }}
      >
        <div className="space-y-4">
          <FormField label="Docente" required>
            {(field) => (
              <Select
                value={manual.teacherId}
                onValueChange={(value) => setManual((current) => ({ ...current, teacherId: value }))}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue placeholder="Seleccione un docente" />
                </SelectTrigger>
                <SelectContent>
                  {(teachers.data ?? []).map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacherLabel(teacher)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Tipo de marcación" required>
            {() => (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={manual.type === 'CHECK_IN' ? 'default' : 'outline'}
                  onClick={() => setManual((current) => ({ ...current, type: 'CHECK_IN' }))}
                >
                  <LogIn />
                  Entrada
                </Button>
                <Button
                  type="button"
                  variant={manual.type === 'CHECK_OUT' ? 'success' : 'outline'}
                  onClick={() => setManual((current) => ({ ...current, type: 'CHECK_OUT' }))}
                >
                  <LogOut />
                  Salida
                </Button>
              </div>
            )}
          </FormField>

          <FormField label="Observación" hint="Se guarda junto con la marcación y en la auditoría.">
            {(field) => (
              <Textarea
                {...field}
                value={manual.notes}
                onChange={(event) =>
                  setManual((current) => ({ ...current, notes: event.target.value }))
                }
                rows={2}
                maxLength={400}
                placeholder="Ej. Marcación registrada en recepción por falla del dispositivo"
              />
            )}
          </FormField>
        </div>
      </FormDialog>

      {/* ── Confirmación de eliminación ──────────────────────── */}
      <FormDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setReason('');
        }}
        title={`Eliminar ${selected.length} marcación(es)`}
        description="Revise el detalle antes de continuar. La acción quedará registrada en la auditoría con su nombre."
        submitLabel="Sí, eliminar"
        cancelLabel="No, cancelar"
        loading={bulkDelete.isPending}
        onSubmit={() => bulkDelete.mutate()}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-red-900">
                Las marcaciones dejarán de aparecer en consultas y reportes
              </p>
              <p className="mt-0.5 text-red-800">
                Se aplica borrado lógico: el registro permanece en la base de datos, de modo que
                la auditoría sigue siendo verificable.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Marcaciones seleccionadas</p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {(data?.items ?? [])
                .filter((row) => selected.includes(row.id))
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">
                        {row.teacher.firstName} {row.teacher.lastName}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{row.teacher.code}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDate(row.date)} · {formatTime(row.registeredAt)}
                      <AttendanceTypeBadge type={row.type} />
                    </span>
                  </div>
                ))}
            </div>
            {selected.some((id) => !(data?.items ?? []).some((row) => row.id === id)) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Algunas marcaciones seleccionadas están en otras páginas y también se eliminarán.
              </p>
            )}
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
                placeholder="Ej. Marcación duplicada por error del dispositivo"
              />
            )}
          </FormField>
        </div>
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle de la marcación"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && (
          <DetailList
            items={[
              {
                label: 'Docente',
                value: `${detail.data.teacher.firstName} ${detail.data.teacher.lastName}`,
              },
              { label: 'Código', value: <Badge variant="outline">{detail.data.teacher.code}</Badge> },
              { label: 'Documento', value: detail.data.teacher.document },
              { label: 'Fecha', value: formatDate(detail.data.date) },
              { label: 'Hora de registro', value: formatDateTime(detail.data.registeredAt) },
              { label: 'Tipo', value: ATTENDANCE_TYPE_LABEL[detail.data.type] },
              { label: 'Estado', value: ATTENDANCE_STATUS_LABEL[detail.data.status] },
              { label: 'Jornada', value: detail.data.schedule?.shift.name ?? '—' },
              { label: 'Hora esperada', value: detail.data.expectedTime ?? '—' },
              {
                label: 'Tolerancia del horario',
                value: detail.data.schedule ? `${detail.data.schedule.toleranceMinutes} min` : '—',
              },
              { label: 'Diferencia', value: `${detail.data.minutesDiff} min` },
              { label: 'Dirección IP', value: detail.data.ipAddress ?? '—' },
              { label: 'Dispositivo', value: detail.data.device ?? '—' },
              { label: 'Observación', value: detail.data.notes ?? '—' },
            ]}
          />
        )}
      </FormDialog>
    </>
  );
}
