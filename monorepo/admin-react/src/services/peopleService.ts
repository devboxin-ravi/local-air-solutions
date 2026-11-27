/**
 * Customers, staff and roles API calls.
 */

import { API } from '@/constants/api';
import type { Address, Booking, Customer, LedgerStatement, Permission, QueryParams, Role, Staff } from '@/types';
import { http } from './apiClient';

export const customerService = {
  list: (params?: QueryParams) => http.page<Customer>(API.CUSTOMERS, params),
  get: (id: number) => http.get<Customer>(API.CUSTOMER(id)),
  create: (body: unknown) => http.post<Customer>(API.CUSTOMERS, body),
  update: (id: number, body: unknown) => http.patch<Customer>(API.CUSTOMER(id), body),
  remove: (id: number) => http.del(API.CUSTOMER(id)),
  checkMobile: (mobile: string) => http.get<Array<{ id: number; fullName: string; customerCode: string }>>(API.CUSTOMER_CHECK_MOBILE, { mobile }),
  allAddresses: (params?: QueryParams) => http.page<Address>(API.CUSTOMER_ADDRESSES_ALL, params),
  addresses: (id: number) => http.get<Address[]>(API.CUSTOMER_ADDRESSES(id)),
  addAddress: (id: number, body: unknown) => http.post<Address>(API.CUSTOMER_ADDRESSES(id), body),
  updateAddress: (id: number, addressId: number, body: unknown) => http.patch<Address>(API.CUSTOMER_ADDRESS(id, addressId), body),
  removeAddress: (id: number, addressId: number) => http.del(API.CUSTOMER_ADDRESS(id, addressId)),
  ledger: (id: number, params?: QueryParams) => http.get<LedgerStatement>(API.CUSTOMER_LEDGER(id), params),
  bookings: (customerId: number, params?: QueryParams) => http.page<Booking>(API.BOOKINGS, { ...params, customerId }),
};

export const staffService = {
  list: (params?: QueryParams) => http.page<Staff>(API.STAFF, params),
  get: (id: number) => http.get<Staff>(API.STAFF_ONE(id)),
  create: (body: unknown) => http.post<Staff>(API.STAFF, body),
  update: (id: number, body: unknown) => http.patch<Staff>(API.STAFF_ONE(id), body),
  history: (id: number, params?: QueryParams) => http.page<{ id: number; status: string; assignedAt: string; booking: Booking }>(API.STAFF_HISTORY(id), params),
  roles: () => http.get<Role[]>(API.ROLES),
  permissions: () => http.get<Permission[]>(API.PERMISSIONS),
  createRole: (body: unknown) => http.post<Role>(API.ROLES, body),
  updateRole: (id: number, body: unknown) => http.patch<Role>(API.ROLE(id), body),
  deleteRole: (id: number) => http.del(API.ROLE(id)),
  /** Soft delete: login disabled and hidden; history kept. */
  remove: (id: number) => http.del(API.STAFF_ONE(id)),
};
