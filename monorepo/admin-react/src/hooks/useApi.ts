/**
 * Thin wrappers over TanStack Query: standardized mutations with toasts + cache invalidation,
 * error-message extraction, and shared lookup queries (branches, states, categories…).
 */

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/services/apiClient';
import { masterService, catalogService } from '@/services/catalogService';
import { staffService } from '@/services/peopleService';
import { MESSAGES } from '@/constants/ui';
import { QUERY } from '@/constants/api';
import type { QueryParams } from '@/types';

export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : MESSAGES.GENERIC_ERROR);
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.details ? e.details : {});

/** Mutation that toasts success/failure and invalidates the given query keys. */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[]; onSuccess?: (r: TResult, vars: TVars) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, vars) => {
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      opts.onSuccess?.(r, vars);
    },
    onError: (e) => {
      if (!opts.silentError) toast.error(errorMessage(e));
    },
  });
}

const LOOKUP_STALE = 5 * 60_000;

export const useBranches = (params?: QueryParams) => useQuery({ queryKey: ['branches', params], queryFn: () => masterService.branches(params), staleTime: LOOKUP_STALE });
export const useStates = () => useQuery({ queryKey: ['states', 'active'], queryFn: () => masterService.states({ activeOnly: true }), staleTime: LOOKUP_STALE });
export const useCities = (stateId?: number | string) =>
  useQuery({ queryKey: ['cities', stateId], queryFn: () => masterService.cities({ stateId: Number(stateId), activeOnly: true }), enabled: !!stateId, staleTime: LOOKUP_STALE });
export const useServiceAreas = (branchId?: number | string) =>
  useQuery({ queryKey: ['service-areas', branchId], queryFn: () => masterService.serviceAreas(branchId ? { branchId: Number(branchId) } : undefined), staleTime: LOOKUP_STALE });
export const useSkills = () => useQuery({ queryKey: ['skills'], queryFn: () => masterService.skills(), staleTime: LOOKUP_STALE });
export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: () => masterService.products({ activeOnly: true }), staleTime: LOOKUP_STALE });
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => catalogService.categories(), staleTime: LOOKUP_STALE });
export const useServiceLookup = (branchId?: number) =>
  useQuery({
    queryKey: ['services', 'lookup', branchId],
    queryFn: () => catalogService.services({ pageSize: QUERY.LOOKUP_PAGE_SIZE, isActive: true, branchId }).then((p) => p.items),
    staleTime: LOOKUP_STALE,
  });
export const useTechnicians = (branchId?: number) =>
  useQuery({
    queryKey: ['staff', 'technicians', branchId],
    queryFn: () => staffService.list({ pageSize: QUERY.LOOKUP_PAGE_SIZE, isTechnician: true, status: 'ACTIVE', branchId }).then((p) => p.items),
    staleTime: 60_000,
  });
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => staffService.roles(), staleTime: LOOKUP_STALE });
