/**
 * Master data business logic: States → Cities → Branches → Service Areas, Skills, Products.
 * Deletion is refused for records in use (deactivate instead).
 */

import { Prisma } from '@prisma/client';
import { AuditActions, ErrorMessages } from '../constants';
import { MasterDataRepository } from '../repositories/masterDataRepository';
import type { AuthUser, RequestMeta } from '../models';
import { ConflictError, NotFoundError } from '../utils/errors';
import { SettingsService } from './settingsService';
import { resolveBranchScope } from './accessControl';

type Entity = 'state' | 'city' | 'branch' | 'serviceArea' | 'skill' | 'product';

const LABELS: Record<Entity, string> = {
  state: 'State',
  city: 'City',
  branch: 'Branch',
  serviceArea: 'Service area',
  skill: 'Skill',
  product: 'Product',
};

export interface MasterListFilter {
  stateId?: number;
  cityId?: number;
  branchId?: number;
  activeOnly?: boolean;
  search?: string;
}

/** Maps Prisma constraint errors to domain errors. */
const mapDbError = (entity: Entity) => (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw new ConflictError(ErrorMessages.ALREADY_EXISTS(LABELS[entity]));
    if (err.code === 'P2003') throw new ConflictError(ErrorMessages.CANNOT_DELETE_IN_USE(LABELS[entity]));
    if (err.code === 'P2025') throw new NotFoundError(LABELS[entity]);
  }
  throw err;
};

export class MasterDataService {
  constructor(
    private readonly repo: MasterDataRepository,
    private readonly settings: SettingsService,
  ) {}

  private active = (f: MasterListFilter) => (f.activeOnly ? { isActive: true } : {});
  private search = (f: MasterListFilter) => (f.search ? { name: { contains: f.search } } : {});

  listStates(f: MasterListFilter) {
    return this.repo.listStates({ ...this.active(f), ...this.search(f) });
  }
  listCities(f: MasterListFilter) {
    return this.repo.listCities({ ...this.active(f), ...this.search(f), ...(f.stateId ? { stateId: f.stateId } : {}) });
  }
  listBranches(f: MasterListFilter, actor?: AuthUser) {
    const scoped = actor && !actor.isCompanyWide && actor.userType !== 'CUSTOMER' ? { id: actor.branchId ?? -1 } : {};
    return this.repo.listBranches({ ...this.active(f), ...this.search(f), ...scoped, ...(f.cityId ? { cityId: f.cityId } : {}) });
  }
  listServiceAreas(f: MasterListFilter, actor?: AuthUser) {
    const branchId = actor && actor.userType !== 'CUSTOMER' ? resolveBranchScope(actor, f.branchId) : f.branchId;
    return this.repo.listServiceAreas({ ...this.active(f), ...this.search(f), ...(branchId ? { branchId } : {}) });
  }
  listSkills(f: MasterListFilter) {
    return this.repo.listSkills({ ...this.active(f), ...this.search(f) });
  }
  listProducts(f: MasterListFilter) {
    return this.repo.listProducts({ ...this.active(f), ...this.search(f) });
  }

  async create(entity: Entity, data: Record<string, unknown>, actor: AuthUser, meta: RequestMeta) {
    const fn = {
      state: () => this.repo.createState(data as Prisma.StateCreateInput),
      city: () => this.repo.createCity(data as Prisma.CityUncheckedCreateInput),
      branch: () => this.repo.createBranch(data as Prisma.BranchUncheckedCreateInput),
      serviceArea: () => this.repo.createServiceArea(data as Prisma.ServiceAreaUncheckedCreateInput),
      skill: () => this.repo.createSkill(data as Prisma.SkillCreateInput),
      product: () => this.repo.createProduct(data as Prisma.ProductCreateInput),
    }[entity];
    const created = await fn().catch(mapDbError(entity));
    await this.settings.audit(actor, AuditActions.CREATE, entity, created.id, null, created, meta);
    return created;
  }

  async update(entity: Entity, id: number, data: Record<string, unknown>, actor: AuthUser, meta: RequestMeta) {
    const fn = {
      state: () => this.repo.updateState(id, data),
      city: () => this.repo.updateCity(id, data),
      branch: () => this.repo.updateBranch(id, data),
      serviceArea: () => this.repo.updateServiceArea(id, data),
      skill: () => this.repo.updateSkill(id, data),
      product: () => this.repo.updateProduct(id, data),
    }[entity];
    const updated = await fn().catch(mapDbError(entity));
    await this.settings.audit(actor, AuditActions.UPDATE, entity, id, null, data, meta);
    return updated;
  }

  /** Soft delete: the record is deactivated (kept for history, restorable from the Active toggle). */
  async remove(entity: Entity, id: number, actor: AuthUser, meta: RequestMeta) {
    await this.update(entity, id, { isActive: false }, actor, meta);
  }

  async getBranch(id: number) {
    const b = await this.repo.findBranch(id);
    if (!b) throw new NotFoundError('Branch');
    return b;
  }

  /** Finds the service area (and thus branch) covering a PIN code. */
  findAreaByPincode(pincode: string) {
    return this.repo.findServiceAreaByPincode(undefined, pincode);
  }
}
