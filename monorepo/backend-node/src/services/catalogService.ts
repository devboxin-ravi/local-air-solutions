/**
 * Dynamic service catalogue: categories, services, branch availability, effective-dated pricing.
 * Nothing about the catalogue is hard-coded in clients.
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorMessages } from '../constants';
import { CatalogRepository, ServiceWithRelations } from '../repositories/catalogRepository';
import { runInTransaction } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { ConflictError, NotFoundError, BusinessRuleError } from '../utils/errors';
import { compact, moneyNumber, slugify, toPageMeta, toPageParams } from '../utils/helpers';
import { SettingsService } from './settingsService';

export interface ServiceListFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  categoryId?: number;
  isActive?: boolean;
  isPopular?: boolean;
  pricingType?: 'FIXED' | 'STARTING' | 'QUOTATION' | 'FREE';
  branchId?: number;
}

const SERVICE_SORT_FIELDS = ['name', 'code', 'basePrice', 'sortOrder', 'createdAt', 'durationMinutes'];

const mapUnique = (entity: string) => (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError(ErrorMessages.ALREADY_EXISTS(entity));
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundError(entity);
  throw err;
};

export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly settings: SettingsService,
  ) {}

  /** Shapes a service for API output with a resolved effective price for a branch. */
  present(s: ServiceWithRelations, branchId?: number) {
    const branchPrice = branchId ? s.pricing.find((p) => p.branchId === branchId) : undefined;
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      imageUrl: s.imageUrl,
      category: s.category,
      categoryId: s.categoryId,
      durationMinutes: s.durationMinutes,
      pricingType: s.pricingType,
      basePrice: moneyNumber(s.basePrice),
      effectivePrice: moneyNumber(branchPrice?.price ?? s.basePrice),
      gstApplicable: s.gstApplicable,
      gstRate: moneyNumber(s.gstRate),
      reminderEligible: s.reminderEligible,
      reminderIntervalMonths: s.reminderIntervalMonths,
      isPopular: s.isPopular,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      skills: s.skills.map((x) => x.skill),
      branches: s.branches.map((x) => x.branch),
      branchPrices: s.pricing.filter((p) => p.branchId).map((p) => ({ branchId: p.branchId, price: moneyNumber(p.price) })),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  // ─── Categories ───
  listCategories(activeOnly: boolean) {
    return this.repo.listCategories(activeOnly ? { isActive: true } : {});
  }

  async createCategory(data: { name: string; description?: string | null; imageUrl?: string | null; icon?: string | null; sortOrder: number; isActive: boolean }, actor: AuthUser, meta: RequestMeta) {
    const created = await this.repo.createCategory({ ...data, slug: slugify(data.name) }).catch(mapUnique('Category'));
    await this.settings.audit(actor, AuditActions.CREATE, 'serviceCategory', created.id, null, created, meta);
    return created;
  }

  async updateCategory(id: number, data: Partial<{ name: string; description: string | null; imageUrl: string | null; icon: string | null; sortOrder: number; isActive: boolean }>, actor: AuthUser, meta: RequestMeta) {
    const before = await this.repo.findCategory(id);
    if (!before) throw new NotFoundError('Category');
    const updated = await this.repo
      .updateCategory(id, compact({ ...data, slug: data.name ? slugify(data.name) : undefined }))
      .catch(mapUnique('Category'));
    await this.settings.audit(actor, AuditActions.UPDATE, 'serviceCategory', id, before, updated, meta);
    return updated;
  }

  /** Soft delete: the category is deactivated (kept for history, restorable from the Active toggle). */
  async deleteCategory(id: number, actor: AuthUser, meta: RequestMeta) {
    await this.repo.updateCategory(id, { isActive: false }).catch(mapUnique('Category'));
    await this.settings.audit(actor, AuditActions.DELETE, 'serviceCategory', id, null, { isActive: false }, meta);
  }

  async reorderCategories(ids: number[]) {
    await runInTransaction((tx) => this.repo.reorder('category', ids, tx));
  }

  // ─── Services ───
  async listServices(f: ServiceListFilter, publicView = false) {
    const p = toPageParams(f.page, f.pageSize);
    const where: Prisma.ServiceWhereInput = {
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(publicView ? { isActive: true, category: { isActive: true } } : f.isActive !== undefined ? { isActive: f.isActive } : {}),
      ...(f.isPopular !== undefined ? { isPopular: f.isPopular } : {}),
      ...(f.pricingType ? { pricingType: f.pricingType } : {}),
      AND: [
        ...(f.search ? [{ OR: [{ name: { contains: f.search } }, { code: { contains: f.search } }, { description: { contains: f.search } }] }] : []),
        // A service with no branch links is available in all branches.
        ...(f.branchId ? [{ OR: [{ branches: { none: {} } }, { branches: { some: { branchId: f.branchId } } }] }] : []),
      ],
    };
    const sortField = f.sortBy && SERVICE_SORT_FIELDS.includes(f.sortBy) ? f.sortBy : 'sortOrder';
    const orderBy: Prisma.ServiceOrderByWithRelationInput[] = [{ [sortField]: f.sortBy ? f.sortOrder ?? 'asc' : 'asc' }, { name: 'asc' }];
    const { items, total } = await this.repo.listServices(where, orderBy, p.skip, p.take);
    return { items: items.map((s) => this.present(s, f.branchId)), meta: toPageMeta(p, total) };
  }

  async getService(id: number, branchId?: number) {
    const s = await this.repo.findService(id);
    if (!s) throw new NotFoundError('Service');
    return this.present(s, branchId);
  }

  async createService(input: Record<string, unknown> & { skillIds: number[]; branchIds: number[] }, actor: AuthUser, meta: RequestMeta) {
    const { skillIds, branchIds, ...data } = input;
    const created = await runInTransaction(async (tx) => {
      const s = await this.repo.createService(data as Prisma.ServiceUncheckedCreateInput, tx).catch(mapUnique('Service code'));
      await this.repo.setServiceSkills(s.id, skillIds, tx);
      await this.repo.setServiceBranches(s.id, branchIds, tx);
      await this.repo.createPricing({ serviceId: s.id, branchId: null, price: s.basePrice }, tx);
      return s;
    });
    await this.settings.audit(actor, AuditActions.CREATE, 'service', created.id, null, created, meta);
    return this.getService(created.id);
  }

  async updateService(id: number, input: Record<string, unknown> & { skillIds?: number[]; branchIds?: number[] }, actor: AuthUser, meta: RequestMeta) {
    const before = await this.repo.findService(id);
    if (!before) throw new NotFoundError('Service');
    const { skillIds, branchIds, ...data } = input;
    const nextType = (data.pricingType as string | undefined) ?? before.pricingType;
    const nextPrice = data.basePrice !== undefined ? Number(data.basePrice) : moneyNumber(before.basePrice);
    if ((nextType === 'FIXED' || nextType === 'STARTING') && nextPrice <= 0) throw new BusinessRuleError('Price is required for fixed/starting price services');

    await runInTransaction(async (tx) => {
      await this.repo.updateService(id, compact(data) as Prisma.ServiceUncheckedUpdateInput, tx).catch(mapUnique('Service code'));
      if (skillIds) await this.repo.setServiceSkills(id, skillIds, tx);
      if (branchIds) await this.repo.setServiceBranches(id, branchIds, tx);
      // Price history: close the previous base price and open a new one.
      if (data.basePrice !== undefined && nextPrice !== moneyNumber(before.basePrice)) {
        await this.repo.closeActivePricing(id, null, tx);
        await this.repo.createPricing({ serviceId: id, branchId: null, price: nextPrice }, tx);
      }
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'service', id, this.present(before), data, meta);
    return this.getService(id);
  }

  async setActive(id: number, isActive: boolean, actor: AuthUser, meta: RequestMeta) {
    return this.updateService(id, { isActive }, actor, meta);
  }

  /** Soft delete: the service is deactivated so past bookings/invoices keep their reference. */
  async deleteService(id: number, actor: AuthUser, meta: RequestMeta) {
    await this.repo.updateService(id, { isActive: false }).catch(mapUnique('Service'));
    await this.settings.audit(actor, AuditActions.DELETE, 'service', id, null, { isActive: false }, meta);
  }

  async reorderServices(ids: number[]) {
    await runInTransaction((tx) => this.repo.reorder('service', ids, tx));
  }

  // ─── Pricing ───
  listPricing(serviceId: number) {
    return this.repo.listPricing(serviceId);
  }

  async setBranchPrice(serviceId: number, branchId: number | null, price: number, actor: AuthUser, meta: RequestMeta) {
    const s = await this.repo.findService(serviceId);
    if (!s) throw new NotFoundError('Service');
    await runInTransaction(async (tx) => {
      await this.repo.closeActivePricing(serviceId, branchId, tx);
      await this.repo.createPricing({ serviceId, branchId, price }, tx);
      if (!branchId) await this.repo.updateService(serviceId, { basePrice: price }, tx);
    });
    await this.settings.audit(actor, AuditActions.UPDATE, 'servicePricing', serviceId, null, { branchId, price }, meta);
    return this.listPricing(serviceId);
  }

  /** Resolves current active services with branch-effective price (used by bookings). */
  async resolveForBooking(serviceIds: number[], branchId: number) {
    const services = await this.repo.findServicesByIds(serviceIds);
    return serviceIds.map((sid) => {
      const s = services.find((x) => x.id === sid);
      if (!s) throw new NotFoundError('Service');
      const availableInBranch = s.branches.length === 0 || s.branches.some((b) => b.branch.id === branchId);
      if (!s.isActive || !availableInBranch) throw new BusinessRuleError(ErrorMessages.SERVICE_UNAVAILABLE(s.name));
      return this.present(s, branchId);
    });
  }

  /** Skill ids required by a set of services (for technician matching). */
  async skillIdsForServices(serviceIds: number[]): Promise<number[]> {
    const services = await this.repo.findServicesByIds(serviceIds);
    return Array.from(new Set(services.flatMap((s) => s.skills.map((k) => k.skill.id))));
  }
}
