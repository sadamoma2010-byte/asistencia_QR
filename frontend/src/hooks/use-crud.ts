'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError, api } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';
import type { Paginated } from '@/types';

/**
 * Hooks genéricos para los módulos CRUD.
 * Todos los módulos exponen el mismo contrato REST:
 *   GET /module · GET /module/:id · POST /module · PATCH /module/:id
 *   DELETE /module/:id · PATCH /module/:id/activate · /deactivate · GET /module/export
 */

export function useList<T>(resource: string, queryString: string, enabled = true) {
  return useQuery({
    queryKey: [resource, 'list', queryString],
    queryFn: () => api.get<Paginated<T>>(`/${resource}${queryString}`),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useDetail<T>(resource: string, id: string | null) {
  return useQuery({
    queryKey: [resource, 'detail', id],
    queryFn: () => api.get<T>(`/${resource}/${id}`),
    enabled: Boolean(id),
  });
}

export function useOptions<T>(resource: string, path = 'options', enabled = true) {
  return useQuery({
    queryKey: [resource, path],
    queryFn: () => api.get<T[]>(`/${resource}/${path}`),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

export function useCrudMutations<T, TCreate, TUpdate = Partial<TCreate>>(
  resource: string,
  labels: { singular: string; gender?: 'm' | 'f' },
) {
  const queryClient = useQueryClient();
  const article = labels.gender === 'f' ? 'La' : 'El';
  const suffix = labels.gender === 'f' ? 'a' : 'o';

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [resource] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const create = useMutation({
    mutationFn: (payload: TCreate) => api.post<T>(`/${resource}`, payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${article} ${labels.singular} se creó correctamente`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, `No fue posible crear ${labels.singular}`)),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TUpdate }) =>
      api.patch<T>(`/${resource}/${id}`, payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${article} ${labels.singular} se actualizó correctamente`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, `No fue posible actualizar ${labels.singular}`)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch<T>(`/${resource}/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(
        `${article} ${labels.singular} se ${variables.active ? `activ${suffix}` : `inactiv${suffix}`} correctamente`,
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, 'No fue posible cambiar el estado del registro')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/${resource}/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success(`${article} ${labels.singular} se eliminó correctamente`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, `No fue posible eliminar ${labels.singular}`)),
  });

  return { create, update, setStatus, remove };
}

/** Descarga la exportación a Excel conservando los filtros activos. */
export function useExport(resource: string, filename: string, path = 'export') {
  return useMutation({
    mutationFn: async (queryString: string) => {
      const blob = await api.download(`/${resource}/${path}${queryString}`);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${filename}_${stamp}.xlsx`);
    },
    onSuccess: () => toast.success('La exportación se descargó correctamente'),
    onError: (error) =>
      toast.error(errorMessage(error, 'No fue posible generar el archivo de Excel')),
  });
}
