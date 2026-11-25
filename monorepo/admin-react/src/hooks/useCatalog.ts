/**
 * Service catalogue & master data logic for pages.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { catalogService, masterService, type MasterResource } from '@/services/catalogService';
import type { QueryParams } from '@/types';
import { useAction } from './useApi';

const SERVICE_KEYS = [['services'], ['service'], ['categories']];

export const useServiceList = (params: QueryParams) =>
  useQuery({ queryKey: ['services', params], queryFn: () => catalogService.services(params), placeholderData: keepPreviousData });

export const useService = (id?: number) => useQuery({ queryKey: ['service', id], queryFn: () => catalogService.service(id as number), enabled: !!id });

export const useServicePricing = (id?: number) => useQuery({ queryKey: ['service', id, 'pricing'], queryFn: () => catalogService.pricing(id as number), enabled: !!id });

export function useServiceActions() {
  return {
    create: useAction((body: unknown) => catalogService.createService(body), { success: 'Service created', invalidate: SERVICE_KEYS, silentError: true }),
    update: useAction((v: { id: number; body: unknown }) => catalogService.updateService(v.id, v.body), { success: 'Service updated', invalidate: SERVICE_KEYS, silentError: true }),
    setActive: useAction((v: { id: number; isActive: boolean }) => catalogService.setActive(v.id, v.isActive), { success: (s) => `${s.name} ${s.isActive ? 'activated' : 'deactivated'}`, invalidate: SERVICE_KEYS }),
    remove: useAction((id: number) => catalogService.deleteService(id), { success: 'Service deleted', invalidate: SERVICE_KEYS }),
    uploadImage: useAction((file: File) => catalogService.uploadImage(file), { success: 'Image uploaded' }),
    setPrice: useAction((v: { id: number; branchId: number | null; price: number }) => catalogService.setPrice(v.id, v.branchId, v.price), { success: 'Price updated', invalidate: SERVICE_KEYS }),
    createCategory: useAction((body: unknown) => catalogService.createCategory(body), { success: 'Category created', invalidate: SERVICE_KEYS }),
    updateCategory: useAction((v: { id: number; body: unknown }) => catalogService.updateCategory(v.id, v.body), { success: 'Category updated', invalidate: SERVICE_KEYS }),
    removeCategory: useAction((id: number) => catalogService.deleteCategory(id), { success: 'Category deleted', invalidate: SERVICE_KEYS }),
    reorderCategories: useAction((ids: number[]) => catalogService.reorderCategories(ids), { success: 'Order saved', invalidate: SERVICE_KEYS }),
  };
}

export const useMasterList = <T,>(resource: MasterResource, params?: QueryParams) =>
  useQuery({ queryKey: [resource, 'admin', params], queryFn: () => masterService.list<T>(resource, params), placeholderData: keepPreviousData });

export function useMasterActions(resource: MasterResource) {
  const invalidate = [[resource], ['branches'], ['states'], ['cities'], ['service-areas'], ['skills'], ['products']];
  return {
    create: useAction((body: unknown) => masterService.create(resource, body), { success: 'Created', invalidate, silentError: true }),
    update: useAction((v: { id: number; body: unknown }) => masterService.update(resource, v.id, v.body), { success: 'Updated', invalidate, silentError: true }),
    remove: useAction((id: number) => masterService.remove(resource, id), { success: 'Deleted', invalidate }),
  };
}
