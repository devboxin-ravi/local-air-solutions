/**
 * Server-driven data table: sortable headers, selection, loading/empty/error states, pagination.
 * UI only — data, sort and paging are controlled by the parent via props/callbacks.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import type { PageMeta } from '@/types';
import { Button, Card, Checkbox, NativeSelect } from './ui/primitives';
import { EmptyState, ErrorState } from './common';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string | number>;
  onSelectedChange?: (next: Set<string | number>) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  dense?: boolean;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  meta,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbar,
  className,
  dense,
}: DataTableProps<T>) {
  const keys = (rows ?? []).map(rowKey);
  const allSelected = selectable && keys.length > 0 && keys.every((k) => selected?.has(k));
  const toggleAll = () => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (allSelected) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onSelectedChange(next);
  };
  const toggle = (k: string | number) => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange(next);
  };
  const cellPad = dense ? 'px-4 py-2.5' : 'px-4 py-3.5';
  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <Card className={cn('overflow-hidden', className)}>
      {toolbar && <div className="border-b px-4 py-3">{toolbar}</div>}
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b bg-slate-50/80">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={!!allSelected} onCheckedChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {columns.map((c) => {
                const active = sortBy === c.key;
                return (
                  <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500', alignCls(c.align), c.headerClassName)}>
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(c.key)} className={cn('inline-flex items-center gap-1 uppercase transition-colors hover:text-brand-blue', active && 'text-brand-blue')}>
                        {c.header}
                        {active ? sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b last:border-0">
                  {selectable && <td className={cellPad} />}
                  {columns.map((c) => (
                    <td key={c.key} className={cellPad}>
                      <div className="skeleton h-4" style={{ width: `${55 + ((i * 17 + c.key.length * 7) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              !error &&
              rows?.map((row) => {
                const k = rowKey(row);
                const isSel = selected?.has(k);
                return (
                  <tr
                    key={k}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('border-b transition-colors duration-micro last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-blue-50/40', isSel && 'bg-brand-blue-50/60')}
                  >
                    {selectable && (
                      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={!!isSel} onCheckedChange={() => toggle(k)} aria-label="Select row" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn(cellPad, 'align-middle', alignCls(c.align), c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
        {!loading && !error && rows && rows.length === 0 && <EmptyState title={emptyTitle ?? 'No records found'} description={emptyDescription ?? 'Try adjusting search or filters.'} action={emptyAction} />}
      </div>
      {meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t bg-slate-50/60 px-4 py-3 sm:flex-row">
          <p className="num text-[12.5px] text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{formatNumber((meta.page - 1) * meta.pageSize + 1)}</span>–
            <span className="font-semibold text-foreground">{formatNumber(Math.min(meta.page * meta.pageSize, meta.total))}</span> of{' '}
            <span className="font-semibold text-foreground">{formatNumber(meta.total)}</span>
          </p>
          <div className="flex items-center gap-2">
            {onPageSizeChange && (
              <NativeSelect aria-label="Rows per page" className="h-8 w-[84px] text-xs" value={meta.pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} / page
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => onPageChange?.(meta.page - 1)}>
              <ChevronLeft />
            </Button>
            <span className="num min-w-[72px] text-center text-[12.5px] font-medium">
              {meta.page} / {meta.totalPages}
            </span>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange?.(meta.page + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
