'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Download, Plus, UserCog } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/misc';
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
import {
  createUserSchema,
  resetPasswordSchema,
  userSchema,
  type ResetPasswordForm,
  type UserForm,
} from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Option, User } from '@/types';

const EMPTY_FORM: UserForm = {
  firstName: '',
  lastName: '',
  document: '',
  email: '',
  phone: '',
  roleId: '',
  status: 'ACTIVE',
  password: '',
};

export default function UsersPage() {
  const { can, user: currentUser } = useAuth();
  const table = useTableState();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: User;
  } | null>(null);

  const { data, isLoading, isFetching } = useList<User>('users', table.queryString, can('users.read'));
  const detail = useDetail<User>('users', detailId);
  const roles = useOptions<Option>('roles', 'options', can('users.read'));
  const mutations = useCrudMutations<User, UserForm>('users', { singular: 'usuario', gender: 'm' });
  const exporter = useExport('users', 'usuarios');

  const form = useForm<UserForm>({
    resolver: zodResolver(editing ? userSchema : createUserSchema),
    defaultValues: EMPTY_FORM,
  });

  const passwordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '', mustChangePassword: true },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ResetPasswordForm }) =>
      api.patch<{ message: string }>(`/users/${id}/reset-password`, {
        newPassword: values.newPassword,
        mustChangePassword: values.mustChangePassword,
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      setPasswordTarget(null);
      passwordForm.reset();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible restablecer la contraseña',
      ),
  });

  useEffect(() => {
    if (!formOpen) return;
    form.reset(
      editing
        ? {
            firstName: editing.firstName,
            lastName: editing.lastName,
            document: editing.document,
            email: editing.email,
            phone: editing.phone ?? '',
            roleId: editing.roleId,
            status: editing.status,
            password: '',
          }
        : EMPTY_FORM,
    );
  }, [formOpen, editing, form]);

  if (!can('users.read')) return <AccessDenied />;

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      document: values.document,
      email: values.email,
      phone: values.phone || undefined,
      roleId: values.roleId,
      status: values.status,
      ...(editing ? {} : { password: values.password }),
    };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload: payload as Partial<UserForm> })
      : mutations.create.mutateAsync(payload as UserForm);

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

  const columns: Column<User>[] = [
    {
      key: 'lastName',
      header: 'Usuario',
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.firstName} {row.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: 'document', header: 'Documento', sortable: true, cell: (row) => row.document },
    {
      key: 'phone',
      header: 'Teléfono',
      cell: (row) => row.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'role.name',
      header: 'Rol',
      sortable: true,
      cell: (row) => <Badge variant="outline">{row.role.name}</Badge>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (row) => <RecordStatusBadge status={row.status} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Último ingreso',
      hideOnMobile: true,
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-sm">{formatDateTime(row.lastLoginAt)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Nunca</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Gestione las cuentas de acceso, sus roles y su estado."
        icon={UserCog}
        actions={
          <>
            {can('users.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('users.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nuevo usuario
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por nombre, correo o documento…"
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
              value={table.filters.roleId ?? ''}
              onValueChange={(value) => table.setFilter('roleId', value)}
              placeholder="Rol"
              allLabel="Todos los roles"
              options={(roles.data ?? []).map((role) => ({
                value: role.id,
                label: role.name ?? '',
              }))}
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        loading={isLoading || (isFetching && !data)}
        getRowId={(row) => row.id}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSortChange={table.setSort}
        onPageChange={table.setPage}
        onLimitChange={table.setLimit}
        emptyTitle="Sin usuarios"
        emptyDescription="No se encontraron usuarios con los criterios aplicados."
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={can('users.update') ? () => { setEditing(row); setFormOpen(true); } : undefined}
            onResetPassword={
              can('users.reset-password') ? () => setPasswordTarget(row) : undefined
            }
            onActivate={
              can('users.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('users.deactivate') && row.status === 'ACTIVE' && row.id !== currentUser?.id
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={
              can('users.delete') && row.id !== currentUser?.id
                ? () => setConfirm({ action: 'delete', row })
                : undefined
            }
            protectedReason={row.id === currentUser?.id ? 'No puede modificar su propia cuenta' : undefined}
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
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        description={
          editing
            ? 'Actualice los datos de la cuenta. El correo y el documento deben ser únicos.'
            : 'Complete los datos para crear una nueva cuenta de acceso.'
        }
        submitLabel={editing ? 'Guardar cambios' : 'Crear usuario'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
        size="lg"
      >
        <FormGrid>
          <FormField label="Nombres" error={form.formState.errors.firstName?.message} required>
            {(field) => (
              <Input {...field} {...form.register('firstName')} placeholder="María Fernanda" error={Boolean(form.formState.errors.firstName)} />
            )}
          </FormField>

          <FormField label="Apellidos" error={form.formState.errors.lastName?.message} required>
            {(field) => (
              <Input {...field} {...form.register('lastName')} placeholder="Gómez Restrepo" error={Boolean(form.formState.errors.lastName)} />
            )}
          </FormField>

          <FormField label="Documento" error={form.formState.errors.document?.message} required>
            {(field) => (
              <Input {...field} {...form.register('document')} inputMode="numeric" placeholder="1094567823" error={Boolean(form.formState.errors.document)} />
            )}
          </FormField>

          <FormField label="Teléfono" error={form.formState.errors.phone?.message}>
            {(field) => (
              <Input {...field} {...form.register('phone')} inputMode="tel" placeholder="3001234567" error={Boolean(form.formState.errors.phone)} />
            )}
          </FormField>

          <FormField
            label="Correo"
            error={form.formState.errors.email?.message}
            required
            className="sm:col-span-2"
          >
            {(field) => (
              <Input {...field} {...form.register('email')} type="email" inputMode="email" placeholder="usuario@institucion.edu.co" error={Boolean(form.formState.errors.email)} />
            )}
          </FormField>

          <FormField label="Rol" error={form.formState.errors.roleId?.message} required>
            {(field) => (
              <Select
                value={form.watch('roleId')}
                onValueChange={(value) => form.setValue('roleId', value, { shouldValidate: true })}
              >
                <SelectTrigger id={field.id} error={Boolean(form.formState.errors.roleId)}>
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Estado" error={form.formState.errors.status?.message} required>
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

          {!editing && (
            <FormField
              label="Contraseña"
              error={form.formState.errors.password?.message}
              hint="Mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial."
              required
              className="sm:col-span-2"
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('password')}
                  type="password"
                  autoComplete="new-password"
                  error={Boolean(form.formState.errors.password)}
                />
              )}
            </FormField>
          )}
        </FormGrid>
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del usuario"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && (
          <DetailList
            items={[
              { label: 'Nombres', value: detail.data.firstName },
              { label: 'Apellidos', value: detail.data.lastName },
              { label: 'Documento', value: detail.data.document },
              { label: 'Correo', value: detail.data.email },
              { label: 'Teléfono', value: detail.data.phone || '—' },
              { label: 'Rol', value: <Badge variant="outline">{detail.data.role.name}</Badge> },
              { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
              {
                label: 'Docente vinculado',
                value: detail.data.teacher ? detail.data.teacher.code : 'Sin vínculo',
              },
              {
                label: 'Último ingreso',
                value: detail.data.lastLoginAt ? formatDateTime(detail.data.lastLoginAt) : 'Nunca',
              },
              { label: 'Creado', value: formatDateTime(detail.data.createdAt) },
              { label: 'Actualizado', value: formatDateTime(detail.data.updatedAt) },
            ]}
          />
        )}
      </FormDialog>

      {/* ── Restablecer contraseña ───────────────────────────── */}
      <FormDialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            passwordForm.reset();
          }
        }}
        title="Restablecer contraseña"
        description={
          passwordTarget
            ? `Se asignará una nueva contraseña a ${passwordTarget.firstName} ${passwordTarget.lastName} y se cerrarán sus sesiones activas.`
            : undefined
        }
        submitLabel="Restablecer"
        loading={resetPassword.isPending}
        onSubmit={passwordForm.handleSubmit((values) =>
          passwordTarget && resetPassword.mutate({ id: passwordTarget.id, values }),
        )}
      >
        <div className="space-y-4">
          <FormField
            label="Nueva contraseña"
            error={passwordForm.formState.errors.newPassword?.message}
            hint="Mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial."
            required
          >
            {(field) => (
              <Input
                {...field}
                {...passwordForm.register('newPassword')}
                type="password"
                autoComplete="new-password"
                error={Boolean(passwordForm.formState.errors.newPassword)}
              />
            )}
          </FormField>

          <FormField
            label="Confirmar contraseña"
            error={passwordForm.formState.errors.confirmPassword?.message}
            required
          >
            {(field) => (
              <Input
                {...field}
                {...passwordForm.register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                error={Boolean(passwordForm.formState.errors.confirmPassword)}
              />
            )}
          </FormField>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={passwordForm.watch('mustChangePassword')}
              onCheckedChange={(checked) =>
                passwordForm.setValue('mustChangePassword', checked === true)
              }
              className="mt-0.5"
            />
            <span className="text-secondary">
              Obligar al usuario a cambiar la contraseña en su próximo ingreso
            </span>
          </label>
        </div>
      </FormDialog>

      {/* ── Confirmaciones ───────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'delete'
            ? 'Eliminar usuario'
            : confirm?.action === 'activate'
              ? 'Activar usuario'
              : 'Inactivar usuario'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `El usuario ${confirm.row.firstName} ${confirm.row.lastName} se eliminará de forma lógica y perderá el acceso al sistema. La acción quedará registrada en la auditoría.`
              : confirm.action === 'activate'
                ? `${confirm.row.firstName} ${confirm.row.lastName} podrá volver a iniciar sesión.`
                : `${confirm.row.firstName} ${confirm.row.lastName} perderá el acceso y sus sesiones activas se cerrarán.`
            : ''
        }
        confirmLabel={
          confirm?.action === 'delete'
            ? 'Eliminar'
            : confirm?.action === 'activate'
              ? 'Activar'
              : 'Inactivar'
        }
        variant={confirm?.action === 'delete' ? 'destructive' : confirm?.action === 'deactivate' ? 'warning' : 'default'}
        loading={mutations.remove.isPending || mutations.setStatus.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
