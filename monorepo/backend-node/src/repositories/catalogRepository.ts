/**
 * Service catalogue data access: categories, services, pricing, skills/branch links.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export const serviceInclude = {
  category: { select: { id: true, name: true, slug: true } },
  skills: { include: { skill: { select: { id: true, name: true } } } },
  branches: { include: { branch: { select: { id: true, name: true } } } },
  pricing: { where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } },
} satisfies Prisma.ServiceInclude;

export type ServiceWithRelations = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

export class CatalogRepository {
  // ─── Categories ───
  listCategories(where: Prisma.ServiceCategoryWhereInput, db: Db = prisma) {
    return db.serviceCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { services: { where: { isActive: true } } } } },
    });
  }
  findCategory(id: number, db: Db = prisma) {
    return db.serviceCategory.findUnique({ where: { id } });
  }
  createCategory(data: Prisma.ServiceCategoryCreateInput, db: Db = prisma) {
    return db.serviceCategory.create({ data });
  }
  updateCategory(id: number, data: Prisma.ServiceCategoryUpdateInput, db: Db = prisma) {
    return db.serviceCategory.update({ where: { id }, data });
  }
  countServicesInCategory(categoryId: number, db: Db = prisma) {
    return db.service.count({ where: { categoryId } });
  }
  deleteCategory(id: number, db: Db = prisma) {
    return db.serviceCategory.delete({ where: { id } });
  }

  // ─── Services ───
  async listServices(where: Prisma.ServiceWhereInput, orderBy: Prisma.ServiceOrderByWithRelationInput[], skip: number, take: number, db: Db = prisma) {
    const [items, total] = await Promise.all([
      db.service.findMany({ where, orderBy, skip, take, include: serviceInclude }),
      db.service.count({ where }),
    ]);
    return { items, total };
  }
  findService(id: number, db: Db = prisma) {
    return db.service.findUnique({ where: { id }, include: serviceInclude });
  }
  findServicesByIds(ids: number[], db: Db = prisma) {
    return db.service.findMany({ where: { id: { in: ids } }, include: serviceInclude });
  }
  findServiceByCode(code: string, db: Db = prisma) {
    return db.service.findUnique({ where: { code } });
  }
  createService(data: Prisma.ServiceUncheckedCreateInput, db: Db = prisma) {
    return db.service.create({ data });
  }
  updateService(id: number, data: Prisma.ServiceUncheckedUpdateInput, db: Db = prisma) {
    return db.service.update({ where: { id }, data });
  }
  countServiceUsage(id: number, db: Db = prisma) {
    return db.bookingItem.count({ where: { serviceId: id } });
  }
  deleteService(id: number, db: Db = prisma) {
    return db.service.delete({ where: { id } });
  }
  async setServiceSkills(serviceId: number, skillIds: number[], db: Db = prisma) {
    await db.serviceSkill.deleteMany({ where: { serviceId } });
    if (skillIds.length) await db.serviceSkill.createMany({ data: skillIds.map((skillId) => ({ serviceId, skillId })) });
  }
  async setServiceBranches(serviceId: number, branchIds: number[], db: Db = prisma) {
    await db.serviceBranch.deleteMany({ where: { serviceId } });
    if (branchIds.length) await db.serviceBranch.createMany({ data: branchIds.map((branchId) => ({ serviceId, branchId })) });
  }
  async reorder(model: 'category' | 'service', ids: number[], db: Db = prisma) {
    for (let i = 0; i < ids.length; i += 1) {
      if (model === 'category') await db.serviceCategory.update({ where: { id: ids[i] }, data: { sortOrder: i } });
      else await db.service.update({ where: { id: ids[i] }, data: { sortOrder: i } });
    }
  }

  // ─── Pricing (effective-dated, history kept) ───
  listPricing(serviceId: number, db: Db = prisma) {
    return db.servicePricing.findMany({
      where: { serviceId },
      orderBy: { effectiveFrom: 'desc' },
      include: { branch: { select: { id: true, name: true } } },
    });
  }
  closeActivePricing(serviceId: number, branchId: number | null, db: Db = prisma) {
    return db.servicePricing.updateMany({ where: { serviceId, branchId, effectiveTo: null }, data: { effectiveTo: new Date() } });
  }
  createPricing(data: Prisma.ServicePricingUncheckedCreateInput, db: Db = prisma) {
    return db.servicePricing.create({ data });
  }
  findActiveBranchPrice(serviceId: number, branchId: number, db: Db = prisma) {
    return db.servicePricing.findFirst({ where: { serviceId, branchId, effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } });
  }
}
