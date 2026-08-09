'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Plus, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DetailList, FormDialog } from '@/components/forms/form-dialog';
import { FormField } from '@/components/forms/form-field';
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
import { formatDateTime } from '@/lib/utils';
import { shiftSchema, type ShiftForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { Shift } from '@/types';

const EMPTY_FORM: ShiftForm = { name: '', description: '', status: 'ACTIVE' };

export default function ShiftsPage() {
  const { can } = useAuth();
  const table = useTableState({ initialSortBy: 'name', initialSortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: 'activate' | 'deactivate' | 'delete';
    row: Shift;
  } | null>(null);

  const { data, isLoading } = useList<Shift>('shifts', table.queryString, can('shifts.read'));
  const detail = useDetail<Shift>('shifts', detailId);
  const mutations = useCrudMutations<Shift, ShiftForm>('shifts', {
    singular: 'jornada',
    gender: 'f',
  });
  const exporter = useExport('shifts', 'jornadas');

  const form = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: EMPTY_FORM });

  useEffect(() => {
    if (!formOpen) return;
    form.reset(
      editing
        ? { name: editing.name, description: editing.description ?? '', status: editing.status }
        : EMPTY_FORM,
    );
  }, [formOpen, editing, form]);

  if (!can('shifts.read')) return <AccessDenied />;

  const onSubmit = form.handleSubmit((values) => {
    const payload = { ...values, description: values.description || undefined };

    const request = editing
      ? mutations.update.mutateAsync({ id: editing.id, payload })
      : mutations.create.mutateAsync(payload as ShiftForm);

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

  const columns: Column<Shift>[] = [
    {
      key: 'name',
      header: 'Jornada',
      sortable: true,
      primary: true,
      cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      cell: (row) => (
        <span className="line-clamp-2 text-sm text-secondary">{row.description || '—'}</span>
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
    {
      key: 'createdAt',
      header: 'Creada',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => <span className="text-sm">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Jornadas"
        description="Defina las jornadas laborales sobre las que se construyen los horarios."
        icon={Sun}
        actions={
          <>
            {can('shifts.export') && (
              <Button
                variant="outline"
                loading={exporter.isPending}
                onClick={() => exporter.mutate(table.exportQueryString)}
              >
                <Download />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            {can('shifts.create') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Nueva jornada
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
              { value: 'ACTIVE', label: 'Activas' },
              { value: 'INACTIVE', label: 'Inactivas' },
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
        emptyTitle="Sin jornadas"
        rowActions={(row) => (
          <RowActions
            status={row.status}
            onView={() => setDetailId(row.id)}
            onEdit={can('shifts.update') ? () => { setEditing(row); setFormOpen(true); } : undefined}
            onActivate={
              can('shifts.activate') && row.status === 'INACTIVE'
                ? () => setConfirm({ action: 'activate', row })
                : undefined
            }
            onDeactivate={
              can('shifts.deactivate') && row.status === 'ACTIVE'
                ? () => setConfirm({ action: 'deactivate', row })
                : undefined
            }
            onDelete={can('shifts.delete') ? () => setConfirm({ action: 'delete', row }) : undefined}
          />
        )}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? 'Editar jornada' : 'Nueva jornada'}
        submitLabel={editing ? 'Guardar cambios' : 'Crear jornada'}
        loading={mutations.create.isPending || mutations.update.isPending}
        onSubmit={onSubmit}
      >
        <div className="space-y-4">
          <FormField label="Nombre" error={form.formState.errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('name')}
                placeholder="Mañana"
                error={Boolean(form.formState.errors.name)}
              />
            )}
          </FormField>

          <FormField label="Descripción" error={form.formState.errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...form.register('description')}
                rows={3}
                placeholder="Jornada de la mañana, de 6:00 a 12:00"
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
                  <SelectItem value="ACTIVE">Activa</SelectItem>
                  <SelectItem value="INACTIVE">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        title="Detalle de la jornada"
        readOnly
        onSubmit={() => undefined}
      >
        {detail.data && (
          <DetailList
            items={[
              { label: 'Nombre', value: detail.data.name },
              { label: 'Estado', value: <RecordStatusBadge status={detail.data.status} /> },
              { label: 'Descripción', value: detail.data.description || '—' },
              { label: 'Horarios asociados', value: detail.data._count?.schedules ?? 0 },
              { label: 'Creada', value: formatDateTime(detail.data.createdAt) },
              { label: 'Actualizada', value: formatDateTime(detail.data.updatedAt) },
            ]}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'delete'
            ? 'Eliminar jornada'
            : confirm?.action === 'activate'
              ? 'Activar jornada'
              : 'Inactivar jornada'
        }
        description={
          confirm
            ? confirm.action === 'delete'
              ? `La jornada ${confirm.row.name} se eliminará. Solo es posible si no tiene horarios asociados.`
              : `La jornada ${confirm.row.name} cambiará de estado.`
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
