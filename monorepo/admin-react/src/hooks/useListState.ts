/**
 * URL-backed list state (page, size, search, sort, filters) so lists are shareable and survive reloads.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QUERY } from '@/constants/api';
import type { QueryParams } from '@/types';
import { useBranchScope } from './useBranchScope';

export interface ListState {
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
}

const RESERVED = ['page', 'pageSize', 'search', 'sortBy', 'sortOrder'];

export function useListState(defaults: Partial<ListState> & { filters?: Record<string, string> } = {}) {
  const [params, setParams] = useSearchParams();
  const { branchId: globalBranchId } = useBranchScope();

  const state: ListState = useMemo(() => {
    const filters: Record<string, string> = { ...(defaults.filters ?? {}) };
    params.forEach((v, k) => {
      if (!RESERVED.includes(k)) filters[k] = v;
    });
    return {
      page: Number(params.get('page') ?? 1),
      pageSize: Number(params.get('pageSize') ?? defaults.pageSize ?? QUERY.DEFAULT_PAGE_SIZE),
      search: params.get('search') ?? '',
      sortBy: params.get('sortBy') ?? defaults.sortBy,
      sortOrder: (params.get('sortOrder') as 'asc' | 'desc') ?? defaults.sortOrder ?? 'desc',
      filters,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch: Record<string, string | number | undefined>, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, String(v));
          });
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setSearch = useCallback((search: string) => update({ search }), [update]);
  const setPage = useCallback((page: number) => update({ page }, false), [update]);
  const setPageSize = useCallback((pageSize: number) => update({ pageSize }), [update]);
  const setFilter = useCallback((key: string, value: string | undefined) => update({ [key]: value }), [update]);
  const toggleSort = useCallback(
    (key: string) => update({ sortBy: key, sortOrder: state.sortBy === key && state.sortOrder === 'desc' ? 'asc' : 'desc' }),
    [update, state.sortBy, state.sortOrder],
  );

  /** Params ready for an API call (header branch selector applies unless a page-level branch filter is set). */
  const query: QueryParams = useMemo(
    () => ({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search || undefined,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      branchId: globalBranchId,
      ...state.filters,
    }),
    [state, globalBranchId],
  );

  return { state, query, setSearch, setPage, setPageSize, setFilter, toggleSort, update };
}
