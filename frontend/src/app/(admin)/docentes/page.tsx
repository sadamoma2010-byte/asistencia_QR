'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { DetailList, FormDialog } from '@/components/forms/form-dialog';
import { FormField, FormGrid } from '@/components/forms/form-field';
import { PhotoPicker } from '@/components/forms/photo-picker';
import { TeacherAvatar } from '@/components/shared/teacher-avatar';
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
import { ApiError, api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { teacherSchema, type TeacherForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Option, Paginated, SubjectRef, Teacher, User } from '@/types';

const EMPTY_FORM: TeacherForm = {
  code: '',
  firstName: '',
  lastName: '',
  document: '',
  email: '',
  phone: '',
  userId: '',
  subjectIds: [],
  status: 'ACTIVE',
};

const NO_USER = 'NONE';

export default function TeachersPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const table = useTableState({ initialSortBy: 'lastName', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Teacher;
  } | null>(null);

  // Fotografía elegida en el formulario; se envía después de guardar los datos
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const { data, isLoading } = useList<Teacher>('teachers', table.queryString, can('teachers.read'));
  const detail = useDetail<Teacher>('teachers', detailId);
  const shifts = useOptions<Option>('shifts', 'options', can('teachers.read'));
  const subjects = useOptions<SubjectRef>('subjects', 'options', can('teachers.read'));
  const mutations = useCrudMutations<Teacher, TeacherForm>('teachers', {
    singular: 'docente',
    gender: 'm',
  });
  const exporter = useExport('teachers', 'docentes');

  // Cuentas disponibles para vincular al docente
  const users = useQuery({
    queryKey: ['users', 'link-options'],
    queryFn: () => api.get<Paginated<User>>('/users?limit=100&status=ACTIVE'),
    enabled: formOpen && can('users.read'),
  });

  const nextCode = useQuery({
    queryKey: ['teachers', 'next-code'],
    queryFn: () => api.get<{ code: string }>('/teachers/next-code'),
    enabled: formOpen && !editing && can('teachers.create'),
  });

  const form = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!formOpen) {
      setPhotoFile(null);
      setPhotoRemoved(false);
      return;
    }
    setPhotoFile(null);
    setPhotoRemoved(false);
    form.reset(
      editing
        ? {
            code: editing.code,
            firstName: editing.firstName,
            lastName: editing.lastName,
            document: editing.document,
            email: editing.email,
            phone: editing.phone ?? '',
            userId: editing.userId ?? '',
            subjectIds: editing.subjects?.map((s) => s.id) ?? [],
            status: editing.status,
          }
        : { ...EMPTY_FORM, code: nextCode.data?.code ?? '' },
    );
  }, [formOpen, editing, nextCode.data, form]);

  if (!can('teachers.read')) return <AccessDenied />;

  /**
   * La fotografía viaja aparte de los datos: primero se guarda el docente
   * (que puede fallar por validación) y solo después se sube la imagen.
   */
  const syncPhoto = async (teacherId: string) => {
    if (!photoFile && !photoRemoved) return;

    setSavingPhoto(true);
    try {
      if (photoFile) {
        const form = new FormData();
        form.append('photo', photoFile);
        await api.upload<Teacher>(`/teachers/${teacherId}/photo`, form);
      } else if (photoRemoved) {
        await api.delete(`/teachers/${teacherId}/photo`);
      }
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
    } catch (error) {
      // El docente sí quedó guardado: se avisa solo del fallo de la imagen
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible guardar la fotografía',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      code: values.code,
      firstName: values.firstName,
      lastName: values.lastName,
      document: values.document,
      email: values.email,
      phone: values.phone || undefined,
      userId: values.userId && values.userId !== NO_USER ? values.userId : undefined,
      subjectIds: values.subjectIds,
      status: values.status,
    };

    try {
      const saved = editing
        ? await mutations.update.mutateAsync({ id: editing.id, payload })
        : await mutations.create.mutateAsync(payload as TeacherForm);

      await syncPhoto(saved.id);

      setFormOpen(false);
      setEditing(null);
    } catch {
      // Los errores de guardado ya los notifica useCrudMutations
    }
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

  const columns: Column<Teacher>[] = [
    {
      key: 'lastName',
      header: 'Docente',
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <TeacherAvatar
            name={`${row.firstName} ${row.lastName}`}
            photoUrl={row.photoUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.firstName} {row.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      sortable: true,
      cell: (row) => <Badge variant="outline">{row.code}</Badge>,
    },
    { key: 'document', header: 'Documento', sortable: true, cell: (row) => row.document },
    {
      key: 'subjects',
      header: 'Asignaturas',
      cell: (row) =>
        row.subjects.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sin asignar</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.subjects.slice(0, 2).map((s) => (
              <Badge key={s.id} variant="outline">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.color ?? '#4F46E5' }}
                  aria-hidden
                />
                {s.name}
              </Badge>
            ))}
            {row.subjects.length > 2 && (
              <Badge variant="secondary">+{row.subjects.length - 2}</Badge>
            )}
          </div>
        ),
    },
    {
      key: 'schedules',
      header: 'Horarios',
      cell: (row) => <Badge variant="default">{row._count?.schedules ?? 0}</Badge>,
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
        title="Docentes"
        description="Administre la información de los docentes y su vínculo con las cuentas de acceso."
        icon={Users}
        actions={
          <>
            {can('teachers.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('teachers.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nuevo docente
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por código, nombre o documento…"
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
                { value: 'ACTIVE', label: 'Activos' },
                { value: 'INACTIVE', label: 'Inactivos' },
              ]}
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
        emptyTitle="Sin docentes"
        emptyDescription="Registre el primer docente para comenzar a controlar la asistencia."
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={
              can('teachers.update') ? () => { setEditing(row); setFormOpen(true); } : undefined
            }
            onActivate={
              can('teachers.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('teachers.deactivate') && row.status === 'ACTIVE'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={can('teachers.delete') ? () => setConfirm({ action: 'delete', row }) : undefined}
          />
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? 'Editar docente' : 'Nuevo docente'}
        description="Vincule una cuenta de usuario para que el docente pueda registrar su asistencia desde el QR."
        submitLabel={editing ? 'Guardar cambios' : 'Crear docente'}
        loading={mutations.create.isPending || mutations.update.isPending || savingPhoto}
        onSubmit={onSubmit}
        size="lg"
      >
        <div className="mb-5">
          <PhotoPicker
            name={`${form.watch('firstName')} ${form.watch('lastName')}`.trim()}
            currentUrl={editing?.photoUrl}
            disabled={savingPhoto}
            onSelect={(file) => {
              setPhotoFile(file);
              if (file) setPhotoRemoved(false);
            }}
            onRemoveExisting={() => setPhotoRemoved(true)}
          />
        </div>

        <FormGrid>
          <FormField label="Código" error={form.formState.errors.code?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('code')}
                placeholder="DOC-0001"
                error={Boolean(form.formState.errors.code)}
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

          <FormField label="Nombres" error={form.formState.errors.firstName?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('firstName')}
                placeholder="Carlos Andrés"
                error={Boolean(form.formState.errors.firstName)}
              />
            )}
          </FormField>

          <FormField label="Apellidos" error={form.formState.errors.lastName?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('lastName')}
                placeholder="Ramírez Loaiza"
                error={Boolean(form.formState.errors.lastName)}
              />
            )}
          </FormField>

          <FormField label="Documento" error={form.formState.errors.document?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('document')}
                inputMode="numeric"
                placeholder="1088456712"
                error={Boolean(form.formState.errors.document)}
              />
            )}
          </FormField>

          <FormField label="Teléfono" error={form.formState.errors.phone?.message}>
            {(field) => (
              <Input
                {...field}
                {...form.register('phone')}
                inputMode="tel"
                placeholder="3109876543"
                error={Boolean(form.formState.errors.phone)}
              />
            )}
          </FormField>

          <FormField
            label="Correo"
            error={form.formState.errors.email?.message}
            required
            className="sm:col-span-2"
          >
            {(field) => (
              <Input
                {...field}
                {...form.register('email')}
                type="email"
                inputMode="email"
                placeholder="docente@institucion.edu.co"
                error={Boolean(form.formState.errors.email)}
              />
            )}
          </FormField>

          <FormField
            label="Asignaturas que dicta"
            hint="Solo estas materias podrán elegirse al crear sus horarios."
            className="sm:col-span-2"
          >
            {() => (
              <div className="flex flex-wrap gap-2 rounded-lg border border-input bg-card p-3">
                {(subjects.data ?? []).map((subject) => {
                  const selected = form.watch('subjectIds').includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        const current = form.getValues('subjectIds');
                        form.setValue(
                          'subjectIds',
                          selected
                            ? current.filter((id) => id !== subject.id)
                            : [...current, subject.id],
                          { shouldDirty: true },
                        );
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        selected
                          ? 'border-transparent bg-primary/10 font-medium text-primary'
                          : 'border-border text-secondary hover:bg-accent',
                      )}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: subject.color ?? '#4F46E5' }}
                        aria-hidden
                      />
                      {subject.name}
                    </button>
                  );
                })}
                {(subjects.data ?? []).length === 0 && (
                  <p className="py-1 text-sm text-muted-foreground">
                    No hay asignaturas creadas todavía. Créelas en el módulo Asignaturas.
                  </p>
                )}
              </div>
            )}
          </FormField>

          {can('users.read') && (
            <FormField
              label="Cuenta de acceso vinculada"
              hint="Opcional. Necesaria para que el docente registre su asistencia desde el QR."
              className="sm:col-span-2"
            >
              {(field) => (
                <Select
                  value={form.watch('userId') || NO_USER}
                  onValueChange={(value) =>
                    form.setValue('userId', value === NO_USER ? '' : value)
                  }
                >
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Sin cuenta vinculada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_USER}>Sin cuenta vinculada</SelectItem>
                    {(users.data?.items ?? []).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} · {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        </FormGrid>
      </FormDialog>

      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del docente"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <TeacherAvatar
                name={`${detail.data.firstName} ${detail.data.lastName}`}
                photoUrl={detail.data.photoUrl}
                size="xl"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {detail.data.firstName} {detail.data.lastName}
                </p>
                <p className="truncate text-sm text-muted-foreground">{detail.data.email}</p>
                <div className="mt-1.5">
                  <RecordStatusBadge status={detail.data.status} />
                </div>
              </div>
            </div>

            <DetailList
              items={[
                { label: 'Código', value: <Badge variant="outline">{detail.data.code}</Badge> },
                { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
                { label: 'Nombres', value: detail.data.firstName },
                { label: 'Apellidos', value: detail.data.lastName },
                { label: 'Documento', value: detail.data.document },
                { label: 'Correo', value: detail.data.email },
                { label: 'Teléfono', value: detail.data.phone || '—' },
                {
                  label: 'Cuenta vinculada',
                  value: detail.data.user ? detail.data.user.email : 'Sin vínculo',
                },
                { label: 'Marcaciones', value: detail.data._count?.attendances ?? 0 },
                { label: 'Creado', value: formatDateTime(detail.data.createdAt) },
              ]}
            />

            <div>
              <p className="mb-2 text-sm font-medium">
                Asignaturas que dicta ({detail.data.subjects?.length ?? 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(detail.data.subjects ?? []).map((s) => (
                  <Badge key={s.id} variant="outline">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: s.color ?? '#4F46E5' }}
                      aria-hidden
                    />
                    {s.code} · {s.name}
                  </Badge>
                ))}
                {(detail.data.subjects ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin asignaturas. No podrá asociarlas a sus horarios.
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                Horarios asignados ({detail.data.schedules?.length ?? 0})
              </p>
              <div className="space-y-2">
                {(detail.data.schedules ?? []).map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{schedule.shift.name}</span>
                    <span className="text-secondary">
                      {schedule.dayName ?? 'Todos los días'} · {schedule.checkInTime}–
                      {schedule.checkOutTime} · ±{schedule.toleranceMinutes} min
                    </span>
                  </div>
                ))}
                {(detail.data.schedules ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin horarios. El docente no podrá registrar asistencia (RN003).
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'delete'
            ? 'Eliminar docente'
            : confirm?.action === 'activate'
              ? 'Activar docente'
              : 'Inactivar docente'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `${confirm.row.firstName} ${confirm.row.lastName} se eliminará de forma lógica junto con sus horarios. El histórico de asistencia se conserva.`
              : confirm.action === 'activate'
                ? `${confirm.row.firstName} ${confirm.row.lastName} podrá volver a registrar asistencia.`
                : `${confirm.row.firstName} ${confirm.row.lastName} no podrá registrar asistencia (RN002).`
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
