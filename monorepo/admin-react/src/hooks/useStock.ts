/**
 * Stock list/actions, and the parts picked for a booking invoice.
 */

import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { stockService } from '@/services/stockService';
import { toNumber } from '@/lib/utils';
import type { QueryParams, StockItem } from '@/types';
import { useAction } from './useApi';

const STOCK_KEYS = [['stock-items']];

export const useStockList = (params: QueryParams) =>
  useQuery({ queryKey: ['stock-items', params], queryFn: () => stockService.list(params), placeholderData: keepPreviousData });

/** Billable items of one branch; idle until a branch is known. */
export const useStockLookup = (branchId?: number) =>
  useQuery({ queryKey: ['stock-items', 'lookup', branchId], queryFn: () => stockService.list({ branchId, activeOnly: true }), enabled: !!branchId });

export function useStockActions() {
  return {
    create: useAction((body: unknown) => stockService.create(body), { success: 'Stock item added', invalidate: STOCK_KEYS, silentError: true }),
    update: useAction((v: { id: number; body: unknown }) => stockService.update(v.id, v.body), { success: 'Stock item updated', invalidate: STOCK_KEYS, silentError: true }),
    adjust: useAction((v: { id: number; change: number; note: string | null }) => stockService.adjust(v.id, v.change, v.note), { success: (s) => `${s.name}: ${s.quantity} ${s.unit} in stock`, invalidate: STOCK_KEYS, silentError: true }),
    remove: useAction((id: number) => stockService.remove(id), { success: 'Deactivated', invalidate: STOCK_KEYS }),
  };
}

/** Invoice line billing one stock item. */
export const stockInvoiceLine = (item: StockItem, quantity = 1) => ({
  serviceId: null,
  stockItemId: item.id,
  description: item.name,
  quantity,
  rate: toNumber(item.salePrice),
  gstRate: toNumber(item.gstRate),
  discount: 0,
});

/** Spare parts added on top of a booking's services while generating its invoice. */
export function useInvoiceParts(branchId?: number) {
  const { data: items } = useStockLookup(branchId);
  const [picked, setPicked] = useState<Array<{ id: number; quantity: number }>>([]);

  const lines = useMemo(
    () =>
      picked.flatMap((p) => {
        const item = items?.find((i) => i.id === p.id);
        return item ? [stockInvoiceLine(item, p.quantity)] : [];
      }),
    [picked, items],
  );

  return {
    items: items ?? [],
    lines,
    add: useCallback((id: number) => setPicked((list) => (list.some((p) => p.id === id) ? list : [...list, { id, quantity: 1 }])), []),
    setQuantity: useCallback((id: number, quantity: number) => setPicked((list) => list.map((p) => (p.id === id ? { ...p, quantity: Math.max(1, Math.floor(quantity) || 1) } : p))), []),
    remove: useCallback((id: number) => setPicked((list) => list.filter((p) => p.id !== id)), []),
    reset: useCallback(() => setPicked([]), []),
  };
}
