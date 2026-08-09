'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Download, Lock, Plus, ShieldCheck } from 'lucide-react';
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
import { Checkbox, Textarea } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrudMutations, useDetail, useExport, useList } from '@/hooks/use-crud';
import { useTableState } from '@/hooks/use-table-state';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { roleSchema, type RoleForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { PermissionGroup, Role } from '@/types';

const EMPTY_FORM: RoleForm = {
  name: '',
  description: '',
  status: 'ACTIVE',
  permissionIds: [],
};

export default function RolesPage() {
  const { can } = useAuth();
  const table = useTableState({ initialSortBy: 'name', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Role;
  } | null>(null);

  const { data, isLoading } = useList<Role>('roles', table.queryString, can('roles.read'));
  const detail = useDetail<Role>('roles', detailId ?? editing?.id ?? null);
  const mutations = useCrudMutations<Role, RoleForm>('roles', { singular: 'rol', gender: 'm' });
  const exporter = useExport('roles', 'roles');

  const permissionGroups = useQuery({
    queryKey: ['permissions', 'grouped'],
    queryFn: () => api.get<PermissionGroup[]>('/permissions/grouped'),
    enabled: formOpen,
    staleTime: 5 * 60_000,
  });

  const form = useForm<RoleForm>({ resolver: zodResolver(roleSchema), defaultValues: EMPTY_FORM });
  const selectedPermissions = form.watch('permissionIds');

  useEffect(() => {
    if (!formOpen) return;
    if (!editing) {
      form.reset(EMPTY_FORM);
      return;
    }
    // Los permisos del rol llegan en el detalle
    form.reset({
      name: editing.name,
      description: editing.description ?? '',
      status: editing.status,
      permissionIds: detail.data?.permissionIds ?? [],
    });
  }, [formOpen, editing, detail.data, form]);

  if (!can('roles.read')) return <AccessDenied />;

  const togglePermission = (id: string) => {
    const current = form.getValues('permissionIds');
    form.setValue(
      'permissionIds',
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleModule = (ids: string[], allSelected: boolean) => {
    const current = form.getValues('permissionIds');
    form.setValue(
      'permissionIds',
      allSelected
        ? current.filter((value) => !ids.includes(value))
        : [...new Set([...current, ...ids])],
    );
  };

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      status: values.status,
      permissionIds: values.permissionIds,
    };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload })
      : mutations.create.mutateAsync(payload as RoleForm);

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

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Rol',
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.name}</span>
          {row.isSystem && (
            <Badge variant="secondary">
              <Lock className="size-3" />
              Sistema
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      cell: (row) => (
        <span className="line-clamp-2 text-sm text-secondary">{row.description || '—'}</span>
      ),
    },
    {
      key: 'users',
      header: 'Usuarios',
      cell: (row) => <Badge variant="outline">{row._count?.users ?? 0}</Badge>,
    },
    {
      key: 'permissions',
      header: 'Permisos',
      cell: (row) => <Badge variant="default">{row._count?.permissions ?? 0}</Badge>,
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
        title="Roles"
        description="Defina los roles del sistema y los permisos que otorgan."
        icon={ShieldCheck}
        actions={
          <>
            {can('roles.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('roles.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nuevo rol
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por nombre o descripción…"
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearFilters}
        filters={
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
        emptyTitle="Sin roles"
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={can('roles.update') ? () => { setEditing(row); setFormOpen(true); } : undefined}
            onActivate={
              can('roles.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('roles.deactivate') && row.status === 'ACTIVE' && row.name !== 'SUPER_ADMIN'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={
              can('roles.delete') && !row.isSystem
                ? () => setConfirm({ action: 'delete', row })
                : undefined
            }
            protectedReason={row.isSystem ? 'Rol del sistema: no puede eliminarse' : undefined}
          />
        )}
      />

      {/* ── Formulario con matriz de permisos ────────────────── */}
      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? `Editar rol · ${editing.name}` : 'Nuevo rol'}
        description="Los permisos determinan a qué módulos y acciones accede el rol."
        submitLabel={editing ? 'Guardar cambios' : 'Crear rol'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
        size="lg"
      >
        <div className="space-y-5">
          <FormGrid>
            <FormField
              label="Nombre del rol"
              error={form.formState.errors.name?.message}
              hint={editing?.isSystem ? 'Los roles del sistema no pueden renombrarse.' : 'Use mayúsculas, ej. COORDINADOR'}
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('name')}
                  placeholder="COORDINADOR"
                  disabled={editing?.isSystem}
                  error={Boolean(form.formState.errors.name)}
                />
              )}
            </FormField>

            <FormField label="Estado" required>
              {(field) => (
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as 'ACTIVE' | 'INACTIVE')}
                  disabled={editing?.name === 'SUPER_ADMIN'}
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

          <FormField label="Descripción" error={form.formState.errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...form.register('description')}
                rows={2}
                placeholder="Describa el alcance del rol"
                error={Boolean(form.formState.errors.description)}
              />
            )}
          </FormField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Permisos asignados</p>
              <Badge variant="default">{selectedPermissions.length} seleccionado(s)</Badge>
            </div>

            {permissionGroups.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando permisos…</p>
            ) : (
              <div className="space-y-3">
                {(permissionGroups.data ?? []).map((group) => {
                  const ids = group.permissions.map((permission) => permission.id);
                  const allSelected = ids.every((id) => selectedPermissions.includes(id));

                  return (
                    <div key={group.module} className="rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2.5 pb-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleModule(ids, allSelected)}
                        />
                        <span className="text-sm font-semibold text-foreground">{group.module}</span>
                      </label>

                      <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-2.5 rounded-md px-1 py-1 text-sm transition-colors hover:bg-accent/50"
                          >
                            <Checkbox
                              checked={selectedPermissions.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block text-secondary">{permission.name}</span>
                              <code className="text-[11px] text-muted-foreground">
                                {permission.code}
                              </code>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del rol"
        readOnly
        onSubmit={() => undefined}
        size="lg"
      >
        {detail.data && detailId && (
          <div className="space-y-5">
            <DetailList
              items={[
                { label: 'Nombre', value: detail.data.name },
                { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
                { label: 'Descripción', value: detail.data.description || '—' },
                { label: 'Usuarios asignados', value: detail.data._count?.users ?? 0 },
                { label: 'Rol del sistema', value: detail.data.isSystem ? 'Sí' : 'No' },
                { label: 'Creado', value: formatDateTime(detail.data.createdAt) },
              ]}
            />

            <div>
              <p className="mb-2 text-sm font-medium">
                Permisos ({detail.data.permissions?.length ?? 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(detail.data.permissions ?? []).map((permission) => (
                  <Badge key={permission.id} variant="outline">
                    {permission.code}
                  </Badge>
                ))}
                {(detail.data.permissions ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Este rol no tiene permisos asignados.</p>
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
            ? 'Eliminar rol'
            : confirm?.action === 'activate'
              ? 'Activar rol'
              : 'Inactivar rol'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `El rol ${confirm.row.name} se eliminará de forma lógica. Solo es posible si no tiene usuarios asignados.`
              : confirm.action === 'activate'
                ? `El rol ${confirm.row.name} volverá a estar disponible.`
                : `El rol ${confirm.row.name} dejará de estar disponible para nuevas asignaciones.`
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
