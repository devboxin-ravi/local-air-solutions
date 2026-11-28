/**
 * Customer management: profiles, addresses, duplicate detection, 360° profile data.
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorMessages, NumberPrefixes } from '../constants';
import { CustomerRepository } from '../repositories/customerRepository';
import { MasterDataRepository } from '../repositories/masterDataRepository';
import { nextSequence, runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { compact, formatCode, toPageMeta, toPageParams } from '../utils/helpers';
import { assertBranchAccess, customerBranchWhere, resolveBranchScope } from './accessControl';
import { SettingsService } from './settingsService';

export interface AddressInput {
  label: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  stateId: number;
  cityId: number;
  pincode: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export interface CustomerInput {
  fullName: string;
  mobile: string;
  email?: string | null;
  alternateMobile?: string | null;
  branchId?: number | null;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string | null;
  reminderIntervalMonths?: number | null;
  address?: AddressInput;
  allowDuplicateMobile: boolean;
}

const SORTABLE = ['fullName', 'customerCode', 'createdAt', 'mobile'];

export class CustomerService {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly master: MasterDataRepository,
    private readonly settings: SettingsService,
  ) {}

  async list(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; branchId?: number; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; customerType?: 'INDIVIDUAL' | 'BUSINESS'; cityId?: number }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...customerBranchWhere(branchId),
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerType ? { customerType: q.customerType } : {}),
      ...(q.cityId ? { addresses: { some: { cityId: q.cityId } } } : {}),
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search } },
              { mobile: { contains: q.search } },
              { customerCode: { contains: q.search } },
              { email: { contains: q.search } },
              { addresses: { some: { OR: [{ line1: { contains: q.search } }, { pincode: { contains: q.search } }] } } },
            ],
          }
        : {}),
    };
    const sortBy = q.sortBy && SORTABLE.includes(q.sortBy) ? q.sortBy : 'createdAt';
    const { items, total } = await this.repo.list(where, { [sortBy]: q.sortOrder ?? 'desc' }, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async get(actor: AuthUser, id: number) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundError('Customer');
    if (c.branchId) assertBranchAccess(actor, c.branchId);
    return c;
  }

  /** Returns existing customers sharing this mobile (shared family/business numbers are allowed with acknowledgement). */
  checkDuplicates(mobile: string) {
    return this.repo.findByMobile(mobile);
  }

  /**
   * Customers created without a resolvable address (e.g. app sign-up before a service area existed)
   * have no branch and are hidden from branch-filtered admin lists. Once one of their addresses
   * resolves to a branch, adopt it. Never overrides a branch that is already set.
   */
  private async adoptBranchIfMissing(customerId: number, branchId: number | null | undefined): Promise<void> {
    if (!branchId) return;
    const customer = await this.repo.findById(customerId);
    if (customer && !customer.branchId) await this.repo.update(customerId, { branchId });
  }

  /**
   * Validates the city/state pair and finds the service area (and so the branch) that serves an address:
   * exact PIN-code match → a branch in the same city → a branch elsewhere in the same state.
   * Returns null when no branch serves the location yet (the team schedules such bookings manually).
   */
  async resolveServiceArea(a: Pick<AddressInput, 'stateId' | 'cityId' | 'pincode'>) {
    const city = await this.master.findCity(a.cityId);
    if (!city || city.stateId !== a.stateId) throw new ValidationError(ErrorMessages.CITY_STATE_MISMATCH);
    return (
      (a.pincode ? await this.master.findServiceAreaByPincode(undefined, a.pincode) : null) ??
      (await this.master.findServiceAreaInCity(a.cityId)) ??
      (await this.master.findServiceAreaInState(a.stateId))
    );
  }

  /**
   * Returns the branch serving a saved address. Addresses created before a matching branch/service area
   * existed carry no service area; those are re-resolved now and the result is persisted on the address.
   */
  async resolveAddressBranch(address: {
    id: number;
    customerId: number;
    stateId: number;
    cityId: number;
    pincode: string | null;
    serviceArea?: { branchId: number } | null;
  }): Promise<number | null> {
    let branchId = address.serviceArea?.branchId ?? null;
    if (!branchId) {
      const area = await this.resolveServiceArea(address);
      if (!area) return null;
      await this.repo.updateAddress(address.id, { serviceAreaId: area.id });
      branchId = area.branchId;
    }
    await this.adoptBranchIfMissing(address.customerId, branchId);
    return branchId;
  }

  async create(actor: AuthUser, input: CustomerInput, meta: RequestMeta) {
    const requestedBranchId = actor.isCompanyWide ? input.branchId ?? null : actor.branchId;
    if (!input.allowDuplicateMobile) {
      const dupes = await this.repo.findByMobile(input.mobile);
      if (dupes.length) {
        throw new ConflictError(`Mobile already used by ${dupes.map((d) => `${d.fullName} (${d.customerCode})`).join(', ')}. Confirm to create anyway.`, 'DUPLICATE_MOBILE');
      }
    }
    const area = input.address ? await this.resolveServiceArea(input.address) : null;
    const serviceAreaId = area?.id ?? null;
    const branchId = requestedBranchId ?? area?.branchId ?? null;
    const created = await runInTransaction(async (tx) => {
      const seq = await nextSequence(tx, 'CUSTOMER');
      const c = await this.repo.create(
        {
          customerCode: formatCode(NumberPrefixes.CUSTOMER, seq),
          fullName: input.fullName,
          mobile: input.mobile,
          email: input.email ?? null,
          alternateMobile: input.alternateMobile ?? null,
          branchId,
          customerType: input.customerType,
          status: input.status,
          notes: input.notes ?? null,
          reminderIntervalMonths: input.reminderIntervalMonths ?? null,
        },
        tx,
      );
      if (input.address) {
        const { isDefault: _d, ...addr } = input.address;
        await this.repo.createAddress({ ...addr, customerId: c.id, isDefault: true, serviceAreaId }, tx);
      }
      return c;
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'customer', created.id, null, created, meta);
    return this.repo.findById(created.id);
  }

  async update(actor: AuthUser, id: number, input: Partial<CustomerInput>, meta: RequestMeta) {
    const before = await this.get(actor, id);
    const { address: _a, allowDuplicateMobile: _x, ...data } = input;
    if (!actor.isCompanyWide) delete data.branchId;
    const updated = await this.repo.update(id, compact(data as Record<string, unknown>) as Prisma.CustomerUncheckedUpdateInput);
    await this.settings.audit(actor, AuditActions.UPDATE, 'customer', id, before, updated, meta);
    return this.repo.findById(id);
  }

  /** Soft delete — historical bookings/invoices remain intact. */
  async remove(actor: AuthUser, id: number, meta: RequestMeta) {
    await this.get(actor, id);
    await this.repo.update(id, { deletedAt: new Date(), status: 'INACTIVE' });
    await this.settings.audit(actor, AuditActions.DELETE, 'customer', id, null, null, meta);
  }

  // ─── Addresses ───
  async listAddresses(customerId: number) {
    return this.repo.listAddresses(customerId);
  }

  async listAllAddresses(actor: AuthUser, q: { page?: number; pageSize?: number; search?: string; branchId?: number; cityId?: number; pincode?: string }) {
    const branchId = resolveBranchScope(actor, q.branchId);
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.CustomerAddressWhereInput = {
      isActive: true,
      customer: { deletedAt: null, ...customerBranchWhere(branchId) },
      ...(q.cityId ? { cityId: q.cityId } : {}),
      ...(q.pincode ? { pincode: { startsWith: q.pincode } } : {}),
      ...(q.search ? { OR: [{ line1: { contains: q.search } }, { landmark: { contains: q.search } }, { customer: { fullName: { contains: q.search } } }] } : {}),
    };
    const { items, total } = await this.repo.listAllAddresses(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  async addAddress(customerId: number, input: AddressInput) {
    const area = await this.resolveServiceArea(input);
    const created = await runInTransaction(async (tx) => {
      const count = await this.repo.countAddresses(customerId, tx);
      const isDefault = input.isDefault || count === 0;
      if (isDefault) await this.repo.clearDefaultAddress(customerId, tx);
      return this.repo.createAddress({ ...input, customerId, isDefault, serviceAreaId: area?.id ?? null }, tx);
    });
    await this.adoptBranchIfMissing(customerId, area?.branchId);
    return created;
  }

  async updateAddress(customerId: number, addressId: number, input: Partial<AddressInput>) {
    const existing = await this.repo.findAddress(addressId);
    if (!existing || existing.customerId !== customerId) throw new NotFoundError('Address');
    let serviceAreaId: number | null | undefined;
    let areaBranchId: number | undefined;
    if (input.cityId || input.stateId || input.pincode) {
      const area = await this.resolveServiceArea({
        stateId: input.stateId ?? existing.stateId,
        cityId: input.cityId ?? existing.cityId,
        pincode: input.pincode ?? existing.pincode,
      });
      serviceAreaId = area?.id ?? null;
      areaBranchId = area?.branchId;
    }
    const updated = await runInTransaction(async (tx) => {
      if (input.isDefault) await this.repo.clearDefaultAddress(customerId, tx);
      return this.repo.updateAddress(addressId, compact({ ...input, serviceAreaId }) as Prisma.CustomerAddressUncheckedUpdateInput, tx);
    });
    await this.adoptBranchIfMissing(customerId, areaBranchId);
    return updated;
  }

  async removeAddress(customerId: number, addressId: number) {
    const existing = await this.repo.findAddress(addressId);
    if (!existing || existing.customerId !== customerId) throw new NotFoundError('Address');
    if (existing.isDefault && (await this.repo.countAddresses(customerId)) > 1) {
      throw new BusinessRuleError('Set another address as default before removing this one.');
    }
    // Soft-deactivate: bookings keep their address snapshot and FK.
    await this.repo.updateAddress(addressId, { isActive: false, isDefault: false });
  }

  // ─── Self-service (customer app) ───
  async getOwnProfile(actor: AuthUser) {
    if (!actor.customerId) throw new ForbiddenError(ErrorMessages.NO_CUSTOMER_PROFILE);
    return this.repo.findById(actor.customerId);
  }

  async updateOwnProfile(actor: AuthUser, data: { fullName?: string; email?: string | null; alternateMobile?: string | null }) {
    if (!actor.customerId) throw new ForbiddenError(ErrorMessages.NO_CUSTOMER_PROFILE);
    await this.repo.update(actor.customerId, compact(data) as Prisma.CustomerUncheckedUpdateInput);
    return this.repo.findById(actor.customerId);
  }
}
