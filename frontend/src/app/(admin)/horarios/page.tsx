'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Download, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DetailList, FormDialog } from '@/components/forms/form-dialog';
import { FormField, FormGrid } from '@/components/forms/form-field';
import { AccessDenied } from '@/components/shared/auth-guard';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { DataToolbar, FilterSelect } from '@/components/shared/data-toolbar';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { RecordStatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrudMutations, useDetail, useExport, useList, useOptions } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { scheduleSchema, type ScheduleForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Option, Schedule, SubjectRef } from '@/types';

const ALL_DAYS = 'ALL_DAYS';

const DAYS = [
  { value: ALL_DAYS, label: 'Todos los días' },
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

/** Cuerpo que espera la API: el día viaja como número o `null`. */
interface SchedulePayload {
  teacherId: string;
  shiftId: string;
  subjectId: string | null;
  dayOfWeek: number | null;
  checkInTime: string;
  checkOutTime: string;
  toleranceMinutes: number;
  status: 'ACTIVE' | 'INACTIVE';
}

const NO_SUBJECT = 'NONE';

const EMPTY_FORM: ScheduleForm = {
  teacherId: '',
  shiftId: '',
  subjectId: '',
  dayOfWeek: ALL_DAYS,
  checkInTime: '07:00',
  checkOutTime: '13:00',
  toleranceMinutes: 10,
  status: 'ACTIVE',
};

export default function SchedulesPage() {
  const { can } = useAuth();
  const table = useTableState({ initialSortBy: 'checkInTime', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Schedule;
  } | null>(null);

  const { data, isLoading } = useList<Schedule>(
    'schedules',
    table.queryString,
    can('schedules.read'),
  );
  const detail = useDetail<Schedule>('schedules', detailId);
  const teachers = useOptions<Option>('teachers', 'options', can('schedules.read'));
  const shifts = useOptions<Option>('shifts', 'options', can('schedules.read'));
  const mutations = useCrudMutations<Schedule, SchedulePayload>('schedules', {
    singular: 'horario',
    gender: 'm',
  });
  const exporter = useExport('schedules', 'horarios');

  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: EMPTY_FORM,
  });

  // El catálogo de asignaturas se acota al docente elegido en el formulario
  const selectedTeacherId = form.watch('teacherId');
  const teacherSubjects = useQuery({
    queryKey: ['subjects', 'options', selectedTeacherId],
    queryFn: () => api.get<SubjectRef[]>(`/subjects/options?teacherId=${selectedTeacherId}`),
    enabled: formOpen && Boolean(selectedTeacherId),
  });

  useEffect(() => {
    if (!formOpen) return;
    form.reset(
      editing
        ? {
            teacherId: editing.teacherId,
            shiftId: editing.shiftId,
            subjectId: editing.subjectId ?? '',
            dayOfWeek: editing.dayOfWeek === null ? ALL_DAYS : String(editing.dayOfWeek),
            checkInTime: editing.checkInTime,
            checkOutTime: editing.checkOutTime,
            toleranceMinutes: editing.toleranceMinutes,
            status: editing.status,
          }
        : EMPTY_FORM,
    );
  }, [formOpen, editing, form]);

  if (!can('schedules.read')) return <AccessDenied />;

  const teacherLabel = (teacher: Option) =>
    `${teacher.lastName ?? ''} ${teacher.firstName ?? ''}`.trim() + ` · ${teacher.code ?? ''}`;

  const onSubmit = form.handleSubmit((values) => {
    const payload: SchedulePayload = {
      teacherId: values.teacherId,
      shiftId: values.shiftId,
      subjectId: values.subjectId && values.subjectId !== NO_SUBJECT ? values.subjectId : null,
      // `null` (y no `undefined`) para poder volver de un día concreto a «todos los días»
      dayOfWeek: values.dayOfWeek === ALL_DAYS ? null : Number(values.dayOfWeek),
      checkInTime: values.checkInTime,
      checkOutTime: values.checkOutTime,
      toleranceMinutes: values.toleranceMinutes,
      status: values.status,
    };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload })
      : mutations.create.mutateAsync(payload);

    void request.then(() => {
      setFormOpen(false);
      setEditing(null);
    });
  });

  const handleConfirm = () => {
    if (!confirm) return;
    const done = () => setConfirm(null);

    if (confirm.action === 'delete') void mutations.remove.mutateAsync(confirm.row.id).then(done);
    else
      void mutations.setStatus
        .mutateAsync({ id: confirm.row.id, active: confirm.action === 'activate' })
        .then(done);
  };

  const columns: Column<Schedule>[] = [
    {
      key: 'teacher',
      header: 'Docente',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.teacher.firstName} {row.teacher.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.teacher.code}</p>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Jornada',
      cell: (row) => <Badge variant="outline">{row.shift.name}</Badge>,
    },
    {
      key: 'subject',
      header: 'Asignatura',
      cell: (row) =>
        row.subject ? (
          <Badge variant="default">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: row.subject.color ?? '#4F46E5' }}
              aria-hidden
            />
            {row.subject.name}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'dayOfWeek',
      header: 'Día',
      sortable: true,
      cell: (row) => <span className="text-sm">{row.dayName ?? 'Todos los días'}</span>,
    },
    {
      key: 'checkInTime',
      header: 'Entrada',
      sortable: true,
      cell: (row) => <span className="font-mono tabular-nums">{row.checkInTime}</span>,
    },
    {
      key: 'checkOutTime',
      header: 'Salida',
      sortable: true,
      cell: (row) => <span className="font-mono tabular-nums">{row.checkOutTime}</span>,
    },
    {
      key: 'toleranceMinutes',
      header: 'Tolerancia',
      cell: (row) => <span className="text-sm">{row.toleranceMinutes} min</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (row) => <RecordStatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Horarios"
        description="Asigne horarios por docente y jornada, con su tolerancia de puntualidad."
        icon={CalendarClock}
        actions={
          <>
            {can('schedules.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('schedules.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nuevo horario
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por docente o jornada…"
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearFilters}
        filters={
          <>
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
                { value: 'ACTIVE', label: 'Activos' },
                { value: 'INACTIVE', label: 'Inactivos' },
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
        emptyTitle="Sin horarios"
        emptyDescription="Sin un horario activo el docente no puede registrar asistencia (RN003)."
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={
              can('schedules.update') ? () => { setEditing(row); setFormOpen(true); } : undefined
            }
            onActivate={
              can('schedules.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('schedules.deactivate') && row.status === 'ACTIVE'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={
              can('schedules.delete') ? () => setConfirm({ action: 'delete', row }) : undefined
            }
          />
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? 'Editar horario' : 'Nuevo horario'}
        description="La tolerancia define cuántos minutos después de la hora de entrada se considera puntual (RN007 y RN008)."
        submitLabel={editing ? 'Guardar cambios' : 'Crear horario'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
        size="lg"
      >
        <FormGrid>
          <FormField label="Docente" error={form.formState.errors.teacherId?.message} required>
            {(field) => (
              <Select
                value={form.watch('teacherId')}
                onValueChange={(value) =>
                  form.setValue('teacherId', value, { shouldValidate: true })
                }
              >
                <SelectTrigger id={field.id} error={Boolean(form.formState.errors.teacherId)}>
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

          <FormField label="Jornada" error={form.formState.errors.shiftId?.message} required>
            {(field) => (
              <Select
                value={form.watch('shiftId')}
                onValueChange={(value) => form.setValue('shiftId', value, { shouldValidate: true })}
              >
                <SelectTrigger id={field.id} error={Boolean(form.formState.errors.shiftId)}>
                  <SelectValue placeholder="Seleccione una jornada" />
                </SelectTrigger>
                <SelectContent>
                  {(shifts.data ?? []).map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Asignatura"
            hint={
              !selectedTeacherId
                ? 'Seleccione primero el docente.'
                : teacherSubjects.data && teacherSubjects.data.length === 0
                  ? 'Este docente no tiene asignaturas. Asígneselas en su ficha.'
                  : 'Solo aparecen las asignaturas que dicta el docente.'
            }
            className="sm:col-span-2"
          >
            {(field) => (
              <Select
                value={form.watch('subjectId') || NO_SUBJECT}
                onValueChange={(value) =>
                  form.setValue('subjectId', value === NO_SUBJECT ? '' : value)
                }
                disabled={!selectedTeacherId}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue placeholder="Sin asignatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUBJECT}>Sin asignatura</SelectItem>
                  {(teacherSubjects.data ?? []).map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.code} · {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Día de la semana"
            hint="«Todos los días» aplica el mismo horario de lunes a domingo."
            className="sm:col-span-2"
          >
            {(field) => (
              <Select
                value={form.watch('dayOfWeek')}
                onValueChange={(value) => form.setValue('dayOfWeek', value)}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Hora de entrada"
            error={form.formState.errors.checkInTime?.message}
            required
          >
            {(field) => (
              <Input
                {...field}
                {...form.register('checkInTime')}
                type="time"
                error={Boolean(form.formState.errors.checkInTime)}
              />
            )}
          </FormField>

          <FormField
            label="Hora de salida"
            error={form.formState.errors.checkOutTime?.message}
            required
          >
            {(field) => (
              <Input
                {...field}
                {...form.register('checkOutTime')}
                type="time"
                error={Boolean(form.formState.errors.checkOutTime)}
              />
            )}
          </FormField>

          <FormField
            label="Tolerancia (minutos)"
            error={form.formState.errors.toleranceMinutes?.message}
            hint="Pasado este margen la marcación se registra como TARDE."
            required
          >
            {(field) => (
              <Input
                {...field}
                {...form.register('toleranceMinutes')}
                type="number"
                min={0}
                max={120}
                error={Boolean(form.formState.errors.toleranceMinutes)}
              />
            )}
          </FormField>

          <FormField label="Estado" required>
            {(field) => (
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as 'ACTIVE' | 'INACTIVE')}
              >
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="INACTIVE">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </FormGrid>
      </FormDialog>

      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del horario"
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
              { label: 'Código', value: detail.data.teacher.code },
              { label: 'Jornada', value: detail.data.shift.name },
              {
                label: 'Asignatura',
                value: detail.data.subject
                  ? `${detail.data.subject.code} · ${detail.data.subject.name}`
                  : 'Sin asignatura',
              },
              { label: 'Día', value: detail.data.dayName ?? 'Todos los días' },
              { label: 'Hora de entrada', value: detail.data.checkInTime },
              { label: 'Hora de salida', value: detail.data.checkOutTime },
              { label: 'Tolerancia', value: `${detail.data.toleranceMinutes} minutos` },
              { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
              { label: 'Creado', value: formatDateTime(detail.data.createdAt) },
            ]}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'delete'
            ? 'Eliminar horario'
            : confirm?.action === 'activate'
              ? 'Activar horario'
              : 'Inactivar horario'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `Se eliminará el horario de ${confirm.row.teacher.firstName} ${confirm.row.teacher.lastName}. Sin horario activo no podrá registrar asistencia (RN003).`
              : `El horario de ${confirm.row.teacher.firstName} ${confirm.row.teacher.lastName} cambiará de estado.`
            : ''
        }
        confirmLabel={confirm?.action === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirm?.action === 'delete' ? 'destructive' : 'warning'}
        loading={mutations.remove.isPending || mutations.setStatus.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
