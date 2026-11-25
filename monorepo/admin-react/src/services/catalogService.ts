/**
 * Master data & service catalogue API calls.
 */

import { API } from '@/constants/api';
import type { Branch, Category, City, Product, QueryParams, Service, ServiceArea, Skill, State } from '@/types';
import { http } from './apiClient';

export type MasterResource = 'states' | 'cities' | 'branches' | 'service-areas' | 'skills' | 'products';

export const masterService = {
  states: (params?: QueryParams) => http.get<State[]>(API.STATES, params),
  cities: (params?: QueryParams) => http.get<City[]>(API.CITIES, params),
  branches: (params?: QueryParams) => http.get<Branch[]>(API.BRANCHES, params),
  serviceAreas: (params?: QueryParams) => http.get<ServiceArea[]>(API.SERVICE_AREAS, params),
  skills: (params?: QueryParams) => http.get<Skill[]>(API.SKILLS, params),
  products: (params?: QueryParams) => http.get<Product[]>(API.PRODUCTS, params),
  list: <T>(resource: MasterResource, params?: QueryParams) => http.get<T[]>(API.MASTER(resource), params),
  create: <T>(resource: MasterResource, body: unknown) => http.post<T>(API.MASTER(resource), body),
  update: <T>(resource: MasterResource, id: number, body: unknown) => http.patch<T>(API.MASTER(resource, id), body),
  remove: (resource: MasterResource, id: number) => http.del(API.MASTER(resource, id)),
};

export interface PriceRow {
  id: number;
  branchId: number | null;
  price: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  branch: { id: number; name: string } | null;
}

export const catalogService = {
  categories: (params?: QueryParams) => http.get<Category[]>(API.CATEGORIES, params),
  createCategory: (body: unknown) => http.post<Category>(API.CATEGORIES, body),
  updateCategory: (id: number, body: unknown) => http.patch<Category>(API.CATEGORY(id), body),
  deleteCategory: (id: number) => http.del(API.CATEGORY(id)),
  reorderCategories: (ids: number[]) => http.put<void>(API.CATEGORIES_REORDER, { ids }),

  services: (params?: QueryParams) => http.page<Service>(API.SERVICES, params),
  service: (id: number) => http.get<Service>(API.SERVICE(id)),
  createService: (body: unknown) => http.post<Service>(API.SERVICES, body),
  updateService: (id: number, body: unknown) => http.patch<Service>(API.SERVICE(id), body),
  setActive: (id: number, isActive: boolean) => http.patch<Service>(API.SERVICE_ACTIVE(id), { isActive }),
  deleteService: (id: number) => http.del(API.SERVICE(id)),
  pricing: (id: number) => http.get<PriceRow[]>(API.SERVICE_PRICING(id)),
  setPrice: (id: number, branchId: number | null, price: number) => http.post(API.SERVICE_PRICING(id), { branchId, price }),
  /** Uploads a service/category photo; returns its public path (e.g. /uploads/catalog/x.jpg). */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<{ path: string }>(API.CATALOG_IMAGES, form);
  },
};
