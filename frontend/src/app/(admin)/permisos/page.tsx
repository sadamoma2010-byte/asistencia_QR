'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Download, KeyRound, Lock, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/misc';
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
import { permissionSchema, type PermissionForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Permission } from '@/types';

const EMPTY_FORM: PermissionForm = {
  code: '',
  name: '',
  module: '',
  description: '',
  status: 'ACTIVE',
};

export default function PermissionsPage() {
  const { can } = useAuth();
  const table = useTableState({ initialSortBy: 'module', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Permission;
  } | null>(null);

  const { data, isLoading } = useList<Permission>(
    'permissions',
    table.queryString,
    can('permissions.read'),
  );
  const detail = useDetail<Permission>('permissions', detailId);
  const mutations = useCrudMutations<Permission, PermissionForm>('permissions', {
    singular: 'permiso',
    gender: 'm',
  });
  const exporter = useExport('permissions', 'permisos');

  const modules = useQuery({
    queryKey: ['permissions', 'modules'],
    queryFn: () => api.get<string[]>('/permissions/modules'),
    enabled: can('permissions.read'),
    staleTime: 5 * 60_000,
  });

  const form = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!formOpen) return;
    form.reset(
      editing
        ? {
            code: editing.code,
            name: editing.name,
            module: editing.module,
            description: editing.description ?? '',
            status: editing.status,
          }
        : EMPTY_FORM,
    );
  }, [formOpen, editing, form]);

  if (!can('permissions.read')) return <AccessDenied />;

  const onSubmit = form.handleSubmit((values) => {
    const payload = { ...values, description: values.description || undefined };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload })
      : mutations.create.mutateAsync(payload as PermissionForm);

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

  const columns: Column<Permission>[] = [
    {
      key: 'code',
      header: 'Permiso',
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <code className="text-xs text-muted-foreground">{row.code}</code>
        </div>
      ),
    },
    {
      key: 'module',
      header: 'Módulo',
      sortable: true,
      cell: (row) => <Badge variant="outline">{row.module}</Badge>,
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
      key: 'roles',
      header: 'Roles',
      cell: (row) => <Badge variant="default">{row._count?.roles ?? 0}</Badge>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <RecordStatusBadge status={row.status} />
          {row.isSystem && (
            <Badge variant="secondary">
              <Lock className="size-3" />
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Permisos"
        description="Catálogo de permisos granulares que se asignan a los roles."
        icon={KeyRound}
        actions={
          <>
            {can('permissions.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('permissions.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nuevo permiso
              </Button>
            )}
          </>
        }
      />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por código, nombre o módulo…"
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearFilters}
        filters={
          <>
            <FilterSelect
              value={table.filters.module ?? ''}
              onValueChange={(value) => table.setFilter('module', value)}
              placeholder="Módulo"
              allLabel="Todos los módulos"
              options={(modules.data ?? []).map((module) => ({ value: module, label: module }))}
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
        emptyTitle="Sin permisos"
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={
              can('permissions.update') ? () => { setEditing(row); setFormOpen(true); } : undefined
            }
            onActivate={
              can('permissions.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('permissions.deactivate') && row.status === 'ACTIVE'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={
              can('permissions.delete') && !row.isSystem
                ? () => setConfirm({ action: 'delete', row })
                : undefined
            }
            protectedReason={row.isSystem ? 'Permiso del sistema: no puede eliminarse' : undefined}
          />
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? 'Editar permiso' : 'Nuevo permiso'}
        description="El código sigue el formato módulo.acción y debe ser único."
        submitLabel={editing ? 'Guardar cambios' : 'Crear permiso'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
      >
        <div className="space-y-4">
          <FormGrid>
            <FormField
              label="Código"
              error={form.formState.errors.code?.message}
              hint={editing?.isSystem ? 'Los permisos del sistema conservan su código.' : 'Ej. reports.export'}
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('code')}
                  placeholder="reports.export"
                  disabled={editing?.isSystem}
                  error={Boolean(form.formState.errors.code)}
                />
              )}
            </FormField>

            <FormField label="Módulo" error={form.formState.errors.module?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...form.register('module')}
                  placeholder="Reportes"
                  list="permission-modules"
                  error={Boolean(form.formState.errors.module)}
                />
              )}
            </FormField>
          </FormGrid>

          <datalist id="permission-modules">
            {(modules.data ?? []).map((module) => (
              <option key={module} value={module} />
            ))}
          </datalist>

          <FormField label="Nombre" error={form.formState.errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('name')}
                placeholder="Exportar reportes"
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
                placeholder="Describa qué habilita este permiso"
                error={Boolean(form.formState.errors.description)}
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
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle del permiso"
        readOnly
        onSubmit={() => undefined}
      >
        {detail.data && (
          <div className="space-y-5">
            <DetailList
              items={[
                { label: 'Código', value: <code className="text-sm">{detail.data.code}</code> },
                { label: 'Nombre', value: detail.data.name },
                { label: 'Módulo', value: <Badge variant="outline">{detail.data.module}</Badge> },
                { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
                { label: 'Descripción', value: detail.data.description || '—' },
                { label: 'Creado', value: formatDateTime(detail.data.createdAt) },
              ]}
            />

            <div>
              <p className="mb-2 text-sm font-medium">Roles que lo incluyen</p>
              <div className="flex flex-wrap gap-1.5">
                {(detail.data.roles ?? []).map((role) => (
                  <Badge key={role.id} variant="default">
                    {role.name}
                  </Badge>
                ))}
                {(detail.data.roles ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Ningún rol tiene este permiso.</p>
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
            ? 'Eliminar permiso'
            : confirm?.action === 'activate'
              ? 'Activar permiso'
              : 'Inactivar permiso'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `El permiso ${confirm.row.code} se eliminará y se retirará de todos los roles.`
              : `El permiso ${confirm.row.code} cambiará de estado. Los roles que lo incluyen se verán afectados de inmediato.`
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
