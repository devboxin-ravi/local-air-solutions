/**
 * Master data & catalogue controllers — HTTP only.
 */

import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendNoContent, sendOk, sendPage } from '../utils/http';

type Entity = 'state' | 'city' | 'branch' | 'serviceArea' | 'skill' | 'product';

// ─── Master data (generic per entity) ───
const listers: Record<Entity, 'listStates' | 'listCities' | 'listBranches' | 'listServiceAreas' | 'listSkills' | 'listProducts'> = {
  state: 'listStates',
  city: 'listCities',
  branch: 'listBranches',
  serviceArea: 'listServiceAreas',
  skill: 'listSkills',
  product: 'listProducts',
};

export const listMaster = (entity: Entity) =>
  asyncHandler(async (req, res) => {
    const svc = services().masterData;
    sendOk(res, await svc[listers[entity]](req.query as never, req.user));
  });

export const createMaster = (entity: Entity) =>
  asyncHandler(async (req, res) => {
    sendCreated(res, await services().masterData.create(entity, req.body, actorOf(req), metaOf(req)));
  });

export const updateMaster = (entity: Entity) =>
  asyncHandler(async (req, res) => {
    sendOk(res, await services().masterData.update(entity, idParam(req), req.body, actorOf(req), metaOf(req)));
  });

export const deleteMaster = (entity: Entity) =>
  asyncHandler(async (req, res) => {
    await services().masterData.remove(entity, idParam(req), actorOf(req), metaOf(req));
    sendNoContent(res);
  });

// ─── Categories ───
export const listCategories = asyncHandler(async (req, res) => {
  const activeOnly = !req.user || req.user.userType === 'CUSTOMER' || req.query.activeOnly === 'true';
  sendOk(res, await services().catalog.listCategories(activeOnly));
});
export const createCategory = asyncHandler(async (req, res) => {
  sendCreated(res, await services().catalog.createCategory(req.body, actorOf(req), metaOf(req)));
});
export const updateCategory = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.updateCategory(idParam(req), req.body, actorOf(req), metaOf(req)));
});
export const deleteCategory = asyncHandler(async (req, res) => {
  await services().catalog.deleteCategory(idParam(req), actorOf(req), metaOf(req));
  sendNoContent(res);
});
export const reorderCategories = asyncHandler(async (req, res) => {
  await services().catalog.reorderCategories(req.body.ids);
  sendNoContent(res);
});

// ─── Services ───
export const listServices = asyncHandler(async (req, res) => {
  const publicView = !req.user || req.user.userType === 'CUSTOMER';
  sendPage(res, await services().catalog.listServices(req.query as never, publicView));
});
export const getService = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.getService(idParam(req), req.query.branchId ? Number(req.query.branchId) : undefined));
});
export const createService = asyncHandler(async (req, res) => {
  sendCreated(res, await services().catalog.createService(req.body, actorOf(req), metaOf(req)));
});
export const updateService = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.updateService(idParam(req), req.body, actorOf(req), metaOf(req)));
});
export const setServiceActive = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.setActive(idParam(req), req.body.isActive, actorOf(req), metaOf(req)));
});
export const deleteService = asyncHandler(async (req, res) => {
  await services().catalog.deleteService(idParam(req), actorOf(req), metaOf(req));
  sendNoContent(res);
});
export const reorderServices = asyncHandler(async (req, res) => {
  await services().catalog.reorderServices(req.body.ids);
  sendNoContent(res);
});
export const listPricing = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.listPricing(idParam(req)));
});
export const setPricing = asyncHandler(async (req, res) => {
  sendOk(res, await services().catalog.setBranchPrice(idParam(req), req.body.branchId ?? null, req.body.price, actorOf(req), metaOf(req)));
});

// ─── Public settings ───
export const publicSettings = asyncHandler(async (_req, res) => {
  sendOk(res, await services().settings.getPublic());
});
