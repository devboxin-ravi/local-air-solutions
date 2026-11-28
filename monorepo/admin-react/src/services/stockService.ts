/**
 * Stock item API calls.
 */

import { API } from '@/constants/api';
import type { QueryParams, StockItem } from '@/types';
import { http } from './apiClient';

export const stockService = {
  list: (params?: QueryParams) => http.get<StockItem[]>(API.STOCK_ITEMS, params),
  create: (body: unknown) => http.post<StockItem>(API.STOCK_ITEMS, body),
  update: (id: number, body: unknown) => http.patch<StockItem>(API.STOCK_ITEM(id), body),
  adjust: (id: number, change: number, note: string | null) => http.post<StockItem>(API.STOCK_ADJUST(id), { change, note }),
  remove: (id: number) => http.del(API.STOCK_ITEM(id)),
};
