'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Download, Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { Checkbox, Textarea } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrudMutations, useDetail, useExport, useList, useOptions } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { subjectSchema, type SubjectForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Option, Subject } from '@/types';

const EMPTY_FORM: SubjectForm = {
  code: '',
  name: '',
  description: '',
  weeklyHours: '',
  color: '#4F46E5',
  status: 'ACTIVE',
};

const PALETTE = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

export default function SubjectsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const table = useTableState({ initialSortBy: 'name', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [teachersTarget, setTeachersTarget] = useState<Subject | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Subject;
  } | null>(null);

  const { data, isLoading } = useList<Subject>('subjects', table.queryString, can('subjects.read'));
  const detail = useDetail<Subject>('subjects', detailId ?? teachersTarget?.id ?? null);
  const teachers = useOptions<Option>('teachers', 'options', can('subjects.read'));
  const mutations = useCrudMutations<Subject, SubjectForm>('subjects', {
    singular: 'asignatura',
    gender: 'f',
  });
  const exporter = useExport('subjects', 'asignaturas');

  const nextCode = useQuery({
    queryKey: ['subjects', 'next-code'],
    queryFn: () => api.get<{ code: string }>('/subjects/next-code'),
    enabled: formOpen && !editing && can('subjects.create'),
  });

  const form = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!formOpen) return;
    form.reset(
      editing
        ? {
            code: editing.code,
            name: editing.name,
            description: editing.description ?? '',
            weeklyHours: editing.weeklyHours ?? '',
            color: editing.color ?? '#4F46E5',
            status: editing.status,
          }
        : { ...EMPTY_FORM, code: nextCode.data?.code ?? '' },
    );
  }, [formOpen, editing, nextCode.data, form]);

  // Al abrir el diálogo de docentes se precargan los ya asignados
  useEffect(() => {
    if (teachersTarget && detail.data?.teachers) {
      setSelectedTeachers(detail.data.teachers.map((t) => t.id));
    }
  }, [teachersTarget, detail.data]);

  if (!can('subjects.read')) return <AccessDenied />;

  const teacherLabel = (teacher: Option) =>
    `${teacher.lastName ?? ''} ${teacher.firstName ?? ''}`.trim() + ` · ${teacher.code ?? ''}`;

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      code: values.code,
      name: values.name,
      description: values.description || undefined,
      weeklyHours: values.weeklyHours === '' ? undefined : Number(values.weeklyHours),
      color: values.color || undefined,
      status: values.status,
    };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload })
      : mutations.create.mutateAsync(payload as SubjectForm);

    void request.then(() => {
      setFormOpen(false);
      setEditing(null);
    });
  });

  const saveTeachers = useMutation({
    mutationFn: (teacherIds: string[]) =>
      api.patch<Subject>(`/subjects/${teachersTarget!.id}/teachers`, { teacherIds }),
    onSuccess: () => {
      toast.success('Docentes actualizados correctamente');
      setTeachersTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible actualizar los docentes',
      ),
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

  const columns: Column<Subject>[] = [
    {
      key: 'name',
      header: 'Asignatura',
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: row.color ?? '#4F46E5' }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      hideOnMobile: true,
      cell: (row) => (
        <span className="line-clamp-2 text-sm text-secondary">{row.description || '—'}</span>
      ),
    },
    {
      key: 'weeklyHours',
      header: 'Horas/semana',
      sortable: true,
      cell: (row) =>
        row.weeklyHours ? (
          <span className="tabular-nums">{row.weeklyHours} h</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'teachers',
      header: 'Docentes',
      cell: (row) => <Badge variant="default">{row._count?.teachers ?? 0}</Badge>,
    },
    {
      key: 'schedules',
      header: 'Horarios',
      cell: (row) => <Badge variant="outline">{row._count?.schedules ?? 0}</Badge>,
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
        title="Asignaturas"
        description="Cree las materias de la institución y asigne qué docentes las dictan."
        icon={BookOpen}
        actions={
          <>
            {can('subjects.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('subjects.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nueva asignatura
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por código, nombre o descripción…"
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearFilters}
        filters={
          <>
            <FilterSelect
              value={table.filters.status ?? ''}
              onValueChange={(value) => table.setFilter('status', value)}
              placeholder="Estado"
              allLabel="Todos los estados"
              options={[
                { value: 'ACTIVE', label: 'Activas' },
                { value: 'INACTIVE', label: 'Inactivas' },
              ]}
            />
            <FilterSelect
              value={table.filters.teacherId ?? ''}
              onValueChange={(value) => table.setFilter('teacherId', value)}
              placeholder="Docente"
              allLabel="Todos los docentes"
              options={(teachers.data ?? []).map((t) => ({ value: t.id, label: teacherLabel(t) }))}
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
        emptyTitle="Sin asignaturas"
        emptyDescription="Cree la primera asignatura para poder asociarla a los docentes."
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={
              can('subjects.update') ? () => { setEditing(row); setFormOpen(true); } : undefined
            }
            onActivate={
              can('subjects.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('subjects.deactivate') && row.status === 'ACTIVE'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={
              can('subjects.delete') ? () => setConfirm({ action: 'delete', row }) : undefined
            }
          />
        )}
      />

      {/* ── Formulario ───────────────────────────────────────── */}
      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? 'Editar asignatura' : 'Nueva asignatura'}
        description="El color se usa para identificar la asignatura en horarios y reportes."
        submitLabel={editing ? 'Guardar cambios' : 'Crear asignatura'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
        size="lg"
      >
        <div className="space-y-4">
          <FormGrid>
            <FormField label="Código" error={form.formState.errors.code?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...form.register('code')}
                  placeholder="MAT-101"
                  error={Boolean(form.formState.errors.code)}
                />
              )}
            </FormField>

            <FormField
              label="Intensidad horaria semanal"
              error={form.formState.errors.weeklyHours?.message}
              hint="Opcional. Horas de clase por semana."
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('weeklyHours')}
                  type="number"
                  min={1}
                  max={60}
                  placeholder="4"
                  error={Boolean(form.formState.errors.weeklyHours)}
                />
              )}
            </FormField>
          </FormGrid>

          <FormField label="Nombre" error={form.formState.errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('name')}
                placeholder="Matemáticas"
                error={Boolean(form.formState.errors.name)}
              />
            )}
          </FormField>

          <FormField label="Descripción" error={form.formState.errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...form.register('description')}
                rows={2}
                placeholder="Álgebra y geometría para grado décimo"
                error={Boolean(form.formState.errors.description)}
              />
            )}
          </FormField>

          <FormField label="Color de identificación">
            {() => (
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => {
                  const active = form.watch('color') === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => form.setValue('color', color, { shouldDirty: true })}
                      aria-label={`Color ${color}`}
                      aria-pressed={active}
                      className={`size-8 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        active ? 'scale-110 ring-2 ring-ring ring-offset-2' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
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
                  <SelectItem value="ACTIVE">Activa</SelectItem>
                  <SelectItem value="INACTIVE">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle de la asignatura"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && detailId && (
          <div className="space-y-5">
            <DetailList
              items={[
                { label: 'Código', value: <Badge variant="outline">{detail.data.code}</Badge> },
                { label: 'Nombre', value: detail.data.name },
                {
                  label: 'Intensidad',
                  value: detail.data.weeklyHours ? `${detail.data.weeklyHours} h/semana` : '—',
                },
                { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
                { label: 'Descripción', value: detail.data.description || '—' },
                { label: 'Horarios asociados', value: detail.data._count?.schedules ?? 0 },
                { label: 'Creada', value: formatDateTime(detail.data.createdAt) },
              ]}
            />

            <div>
              <p className="mb-2 text-sm font-medium">
                Docentes que la dictan ({detail.data.teachers?.length ?? 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(detail.data.teachers ?? []).map((t) => (
                  <Badge key={t.id} variant="default">
                    {t.firstName} {t.lastName}
                  </Badge>
                ))}
                {(detail.data.teachers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ningún docente tiene asignada esta materia todavía.
                  </p>
                )}
              </div>
            </div>

            {can('subjects.update') && (
              <Button
                variant="outline"
                onClick={() => {
                  const row = detail.data as Subject;
                  setDetailId(null);
                  setTeachersTarget(row);
                }}
              >
                <Users />
                Gestionar docentes
              </Button>
            )}
          </div>
        )}
      </FormDialog>

      {/* ── Docentes de la asignatura ────────────────────────── */}
      <FormDialog
        open={Boolean(teachersTarget)}
        onOpenChange={(open) => !open && setTeachersTarget(null)}
        title={teachersTarget ? `Docentes · ${teachersTarget.name}` : 'Docentes'}
        description="Marque los docentes que dictan esta asignatura."
        submitLabel="Guardar"
        loading={saveTeachers.isPending}
        onSubmit={() => saveTeachers.mutate(selectedTeachers)}
        size="lg"
      >
        <div className="space-y-2">
          {(teachers.data ?? []).map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2.5 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-accent/50"
            >
              <Checkbox
                checked={selectedTeachers.includes(t.id)}
                onCheckedChange={(checked) =>
                  setSelectedTeachers((current) =>
                    checked === true ? [...current, t.id] : current.filter((id) => id !== t.id),
                  )
                }
              />
              <span>{teacherLabel(t)}</span>
            </label>
          ))}
          {(teachers.data ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay docentes registrados todavía.
            </p>
          )}
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'delete'
            ? 'Eliminar asignatura'
            : confirm?.action === 'activate'
              ? 'Activar asignatura'
              : 'Inactivar asignatura'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `La asignatura ${confirm.row.name} se eliminará. Solo es posible si no tiene horarios asociados.`
              : `La asignatura ${confirm.row.name} cambiará de estado.`
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
