/**
 * Master data, service catalogue and public settings — route definitions only.
 */

import { Router } from 'express';
import * as c from '../../controllers/masterDataController';
import * as stock from '../../controllers/stockController';
import { authenticate, optionalAuthenticate, requireAnyPermission, requirePermission, requireUserType } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadFiles } from '../../middleware/upload';
import { perm, UploadRules } from '../../constants';
import { idParams } from '../../validations/common';
import { branchSchema, citySchema, masterListQuery, productSchema, serviceAreaSchema, skillSchema, stateSchema, stockAdjustSchema, stockItemSchema, stockItemUpdateSchema, stockListQuery } from '../../validations/masterData';
import { activeSchema, categorySchema, pricingSchema, reorderSchema, serviceListQuery, serviceSchema, serviceUpdateSchema } from '../../validations/catalog';
import { ZodTypeAny } from 'zod';

const r = Router();

// ─── Public (customer app + admin) ───
r.get('/settings/public', c.publicSettings);
r.get('/categories', optionalAuthenticate, c.listCategories);
r.get('/services', optionalAuthenticate, validate({ query: serviceListQuery }), c.listServices);
r.get('/services/:id', validate({ params: idParams }), c.getService);

// Read-only master data needed by registration/address forms.
r.get('/states', validate({ query: masterListQuery }), c.listMaster('state'));
r.get('/cities', validate({ query: masterListQuery }), c.listMaster('city'));
r.get('/branches', optionalAuthenticate, validate({ query: masterListQuery }), c.listMaster('branch'));
r.get('/products', validate({ query: masterListQuery }), c.listMaster('product'));
r.get('/skills', authenticate, validate({ query: masterListQuery }), c.listMaster('skill'));
r.get('/service-areas', authenticate, validate({ query: masterListQuery }), c.listMaster('serviceArea'));

// ─── Admin master data CRUD ───
const crud = (path: string, entity: 'state' | 'city' | 'branch' | 'serviceArea' | 'skill' | 'product', schema: ZodTypeAny & { partial?: () => ZodTypeAny }) => {
  const partial = (schema as unknown as { partial: () => ZodTypeAny }).partial();
  r.post(path, authenticate, requirePermission(perm('masterData', 'create')), validate({ body: schema }), c.createMaster(entity));
  r.patch(`${path}/:id`, authenticate, requirePermission(perm('masterData', 'edit')), validate({ params: idParams, body: partial }), c.updateMaster(entity));
  r.delete(`${path}/:id`, authenticate, requirePermission(perm('masterData', 'delete')), validate({ params: idParams }), c.deleteMaster(entity));
};
crud('/states', 'state', stateSchema);
crud('/cities', 'city', citySchema);
crud('/branches', 'branch', branchSchema);
crud('/service-areas', 'serviceArea', serviceAreaSchema);
crud('/skills', 'skill', skillSchema);
crud('/products', 'product', productSchema);

// ─── Stock (also listed by invoice creators, to bill parts) ───
const admin = requireUserType('ADMIN');
r.get('/stock-items', authenticate, admin, requireAnyPermission(perm('masterData', 'view'), perm('invoices', 'create')), validate({ query: stockListQuery }), stock.listStock);
r.post('/stock-items', authenticate, admin, requirePermission(perm('masterData', 'create')), validate({ body: stockItemSchema }), stock.createStockItem);
r.patch('/stock-items/:id', authenticate, admin, requirePermission(perm('masterData', 'edit')), validate({ params: idParams, body: stockItemUpdateSchema }), stock.updateStockItem);
r.post('/stock-items/:id/adjust', authenticate, admin, requirePermission(perm('masterData', 'edit')), validate({ params: idParams, body: stockAdjustSchema }), stock.adjustStock);
r.delete('/stock-items/:id', authenticate, admin, requirePermission(perm('masterData', 'delete')), validate({ params: idParams }), stock.deleteStockItem);

// ─── Catalogue photos (returns the stored path; the form then saves it as imageUrl) ───
r.post(
  '/catalog/images',
  authenticate,
  requirePermission(perm('services', 'edit')),
  uploadFiles(UploadRules.CATALOG_FOLDER, UploadRules.CATALOG_FIELD, UploadRules.IMAGE_MIME_TYPES, 1),
  c.uploadCatalogImage,
);

// ─── Categories ───
r.post('/categories', authenticate, requirePermission(perm('services', 'create')), validate({ body: categorySchema }), c.createCategory);
r.put('/categories/reorder', authenticate, requirePermission(perm('services', 'edit')), validate({ body: reorderSchema }), c.reorderCategories);
r.patch('/categories/:id', authenticate, requirePermission(perm('services', 'edit')), validate({ params: idParams, body: categorySchema.partial() }), c.updateCategory);
r.delete('/categories/:id', authenticate, requirePermission(perm('services', 'delete')), validate({ params: idParams }), c.deleteCategory);

// ─── Services ───
r.post('/services', authenticate, requirePermission(perm('services', 'create')), validate({ body: serviceSchema }), c.createService);
r.put('/services/reorder', authenticate, requirePermission(perm('services', 'edit')), validate({ body: reorderSchema }), c.reorderServices);
r.patch('/services/:id', authenticate, requirePermission(perm('services', 'edit')), validate({ params: idParams, body: serviceUpdateSchema }), c.updateService);
r.patch('/services/:id/active', authenticate, requirePermission(perm('services', 'edit')), validate({ params: idParams, body: activeSchema }), c.setServiceActive);
r.delete('/services/:id', authenticate, requirePermission(perm('services', 'delete')), validate({ params: idParams }), c.deleteService);
r.get('/services/:id/pricing', authenticate, requirePermission(perm('services', 'view')), validate({ params: idParams }), c.listPricing);
r.post('/services/:id/pricing', authenticate, requirePermission(perm('services', 'edit')), validate({ params: idParams, body: pricingSchema }), c.setPricing);

export { r as catalogRoutes };

