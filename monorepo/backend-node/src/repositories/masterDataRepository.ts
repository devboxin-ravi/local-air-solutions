/**
 * Master data access: states, cities, branches, service areas, skills, products.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export class MasterDataRepository {
  // ─── States ───
  listStates(where: Prisma.StateWhereInput, db: Db = prisma) {
    return db.state.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { cities: true } } } });
  }
  findState(id: number, db: Db = prisma) {
    return db.state.findUnique({ where: { id } });
  }
  createState(data: Prisma.StateCreateInput, db: Db = prisma) {
    return db.state.create({ data });
  }
  updateState(id: number, data: Prisma.StateUpdateInput, db: Db = prisma) {
    return db.state.update({ where: { id }, data });
  }
  deleteState(id: number, db: Db = prisma) {
    return db.state.delete({ where: { id } });
  }

  // ─── Cities ───
  listCities(where: Prisma.CityWhereInput, db: Db = prisma) {
    return db.city.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { state: { select: { id: true, name: true } }, _count: { select: { branches: true } } },
    });
  }
  findCity(id: number, db: Db = prisma) {
    return db.city.findUnique({ where: { id } });
  }
  createCity(data: Prisma.CityUncheckedCreateInput, db: Db = prisma) {
    return db.city.create({ data });
  }
  updateCity(id: number, data: Prisma.CityUncheckedUpdateInput, db: Db = prisma) {
    return db.city.update({ where: { id }, data });
  }
  deleteCity(id: number, db: Db = prisma) {
    return db.city.delete({ where: { id } });
  }

  // ─── Branches ───
  listBranches(where: Prisma.BranchWhereInput, db: Db = prisma) {
    return db.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        city: { select: { id: true, name: true, state: { select: { id: true, name: true } } } },
        _count: { select: { serviceAreas: true, staff: true, customers: true } },
      },
    });
  }
  findBranch(id: number, db: Db = prisma) {
    return db.branch.findUnique({ where: { id }, include: { city: { include: { state: true } } } });
  }
  createBranch(data: Prisma.BranchUncheckedCreateInput, db: Db = prisma) {
    return db.branch.create({ data });
  }
  updateBranch(id: number, data: Prisma.BranchUncheckedUpdateInput, db: Db = prisma) {
    return db.branch.update({ where: { id }, data });
  }
  deleteBranch(id: number, db: Db = prisma) {
    return db.branch.delete({ where: { id } });
  }

  // ─── Service areas ───
  listServiceAreas(where: Prisma.ServiceAreaWhereInput, db: Db = prisma) {
    return db.serviceArea.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { branch: { select: { id: true, name: true } }, _count: { select: { staff: true } } },
    });
  }
  findServiceArea(id: number, db: Db = prisma) {
    return db.serviceArea.findUnique({ where: { id } });
  }
  findServiceAreaByPincode(branchIds: number[] | undefined, pincode: string, db: Db = prisma) {
    return db.serviceArea.findFirst({
      where: { isActive: true, pincodes: { contains: pincode }, ...(branchIds ? { branchId: { in: branchIds } } : {}) },
    });
  }
  /** First active service area of an active branch located in the given city. */
  findServiceAreaInCity(cityId: number, db: Db = prisma) {
    return db.serviceArea.findFirst({ where: { isActive: true, branch: { isActive: true, cityId } }, orderBy: { id: 'asc' } });
  }
  /** First active service area of an active branch located anywhere in the given state. */
  findServiceAreaInState(stateId: number, db: Db = prisma) {
    return db.serviceArea.findFirst({ where: { isActive: true, branch: { isActive: true, city: { stateId } } }, orderBy: { id: 'asc' } });
  }
  createServiceArea(data: Prisma.ServiceAreaUncheckedCreateInput, db: Db = prisma) {
    return db.serviceArea.create({ data });
  }
  updateServiceArea(id: number, data: Prisma.ServiceAreaUncheckedUpdateInput, db: Db = prisma) {
    return db.serviceArea.update({ where: { id }, data });
  }
  deleteServiceArea(id: number, db: Db = prisma) {
    return db.serviceArea.delete({ where: { id } });
  }

  // ─── Skills ───
  listSkills(where: Prisma.SkillWhereInput, db: Db = prisma) {
    return db.skill.findMany({ where, orderBy: { name: 'asc' } });
  }
  createSkill(data: Prisma.SkillCreateInput, db: Db = prisma) {
    return db.skill.create({ data });
  }
  updateSkill(id: number, data: Prisma.SkillUpdateInput, db: Db = prisma) {
    return db.skill.update({ where: { id }, data });
  }
  deleteSkill(id: number, db: Db = prisma) {
    return db.skill.delete({ where: { id } });
  }

  // ─── Products ───
  listProducts(where: Prisma.ProductWhereInput, db: Db = prisma) {
    return db.product.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }
  createProduct(data: Prisma.ProductCreateInput, db: Db = prisma) {
    return db.product.create({ data });
  }
  updateProduct(id: number, data: Prisma.ProductUpdateInput, db: Db = prisma) {
    return db.product.update({ where: { id }, data });
  }
  deleteProduct(id: number, db: Db = prisma) {
    return db.product.delete({ where: { id } });
  }
}
