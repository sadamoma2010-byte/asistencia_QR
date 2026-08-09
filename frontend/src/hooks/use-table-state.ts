'use client';

import { useCallback, useMemo, useState } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import { toQueryString } from '@/lib/utils';

type Filters = Record<string, string>;

interface UseTableStateOptions {
  initialLimit?: number;
  initialSortBy?: string;
  initialSortOrder?: 'asc' | 'desc';
  initialFilters?: Filters;
}

/**
 * Estado compartido de los listados server side: paginación, búsqueda con
 * debounce, ordenamiento y filtros. Devuelve el query string listo para la API.
 */
export function useTableState({
  initialLimit = 10,
  initialSortBy = 'createdAt',
  initialSortOrder = 'desc',
  initialFilters = {},
}: UseTableStateOptions = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const debouncedSearch = useDebounce(search);

  // Cualquier cambio de criterio devuelve el listado a la primera página
  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value === 'ALL' ? '' : value }));
    setPage(1);
  }, []);

  const setSort = useCallback((field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  }, []);

  const changeLimit = useCallback((value: number) => {
    setLimit(value);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchValue('');
    setFilters(initialFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters = useMemo(
    () => Boolean(search) || Object.values(filters).some(Boolean),
    [search, filters],
  );

  /** Query string con los parámetros de listado (paginado). */
  const queryString = useMemo(
    () =>
      toQueryString({
        page,
        limit,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        ...filters,
      }),
    [page, limit, debouncedSearch, sortBy, sortOrder, filters],
  );

  /** Query string sin paginación, para las exportaciones. */
  const exportQueryString = useMemo(
    () =>
      toQueryString({
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        ...filters,
      }),
    [debouncedSearch, sortBy, sortOrder, filters],
  );

  return {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    filters,
    queryString,
    exportQueryString,
    hasActiveFilters,
    setPage,
    setLimit: changeLimit,
    setSearch,
    setSort,
    setFilter,
    clearFilters,
  };
}

export type TableState = ReturnType<typeof useTableState>;
