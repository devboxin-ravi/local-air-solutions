/**
 * Customer, staff and role logic for pages.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { customerService, staffService } from '@/services/peopleService';
import { CUSTOMER_PICKER } from '@/constants/ui';
import type { QueryParams } from '@/types';
import { useAction } from './useApi';
import { useBranchScope } from './useBranchScope';

export const useCustomerList = (params: QueryParams) =>
  useQuery({ queryKey: ['customers', params], queryFn: () => customerService.list(params), placeholderData: keepPreviousData });

export const useCustomer = (id?: number) => useQuery({ queryKey: ['customer', id], queryFn: () => customerService.get(id as number), enabled: !!id });

export const useCustomerAddresses = (id?: number) => useQuery({ queryKey: ['customer', id, 'addresses'], queryFn: () => customerService.addresses(id as number), enabled: !!id });

export const useAllAddresses = (params: QueryParams) =>
  useQuery({ queryKey: ['addresses', params], queryFn: () => customerService.allAddresses(params), placeholderData: keepPreviousData });

export const useLedger = (customerId?: number, params?: QueryParams) =>
  useQuery({ queryKey: ['ledger', customerId, params], queryFn: () => customerService.ledger(customerId as number, params), enabled: !!customerId, placeholderData: keepPreviousData });

export const useCustomerBookings = (customerId?: number, params?: QueryParams) =>
  useQuery({ queryKey: ['bookings', 'customer', customerId, params], queryFn: () => customerService.bookings(customerId as number, params), enabled: !!customerId });

/** Async customer picker search (used by booking/invoice/AMC forms). */
/**
 * Customer picker options: every matching customer (A–Z) in the branch selected in the header — the same
 * set the Customers list shows (incl. customers not yet assigned to a branch). "All branches" → everyone.
 */
export const useCustomerSearch = (search: string) => {
  const { branchId } = useBranchScope();
  return useQuery({
    queryKey: ['customers', 'picker', search, branchId],
    queryFn: () => customerService.listAll({ search, branchId, sortBy: CUSTOMER_PICKER.SORT_BY, sortOrder: 'asc' }, CUSTOMER_PICKER.PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
};

export function useCustomerActions() {
  const invalidate = [['customers'], ['customer'], ['addresses']];
  return {
    create: useAction((body: unknown) => customerService.create(body), { success: (c) => `Customer ${c.customerCode} created`, invalidate, silentError: true }),
    update: useAction((v: { id: number; body: unknown }) => customerService.update(v.id, v.body), { success: 'Customer updated', invalidate, silentError: true }),
    remove: useAction((id: number) => customerService.remove(id), { success: 'Customer archived', invalidate }),
    addAddress: useAction((v: { id: number; body: unknown }) => customerService.addAddress(v.id, v.body), { success: 'Address added', invalidate, silentError: true }),
    updateAddress: useAction((v: { id: number; addressId: number; body: unknown }) => customerService.updateAddress(v.id, v.addressId, v.body), { success: 'Address updated', invalidate, silentError: true }),
    removeAddress: useAction((v: { id: number; addressId: number }) => customerService.removeAddress(v.id, v.addressId), { success: 'Address removed', invalidate }),
  };
}

export const useCheckMobile = () => useAction((mobile: string) => customerService.checkMobile(mobile), { silentError: true });

export const useStaffList = (params: QueryParams) =>
  useQuery({ queryKey: ['staff', params], queryFn: () => staffService.list(params), placeholderData: keepPreviousData });

export const useStaffHistory = (id?: number) => useQuery({ queryKey: ['staff', id, 'history'], queryFn: () => staffService.history(id as number, { pageSize: 10 }), enabled: !!id });

export function useStaffActions() {
  const invalidate = [['staff']];
  return {
    create: useAction((body: unknown) => staffService.create(body), { success: 'Staff member created', invalidate, silentError: true }),
    update: useAction((v: { id: number; body: unknown }) => staffService.update(v.id, v.body), { success: 'Staff member updated', invalidate, silentError: true }),
    remove: useAction((id: number) => staffService.remove(id), { success: 'Staff member deleted', invalidate }),
  };
}

export const usePermissions = () => useQuery({ queryKey: ['permissions'], queryFn: () => staffService.permissions(), staleTime: 300_000 });

export function useRoleActions() {
  const invalidate = [['roles']];
  return {
    create: useAction((body: unknown) => staffService.createRole(body), { success: 'Role created', invalidate }),
    update: useAction((v: { id: number; body: unknown }) => staffService.updateRole(v.id, v.body), { success: 'Role updated', invalidate }),
    remove: useAction((id: number) => staffService.deleteRole(id), { success: 'Role deleted', invalidate }),
  };
}
