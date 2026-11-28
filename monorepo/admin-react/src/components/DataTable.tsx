/**
 * Server-driven data table: sortable headers, selection, loading/empty/error states, pagination.
 * UI only — data, sort and paging are controlled by the parent via props/callbacks.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, Pencil, Trash2, XCircle } from 'lucide-react';
import { cn, formatNumber, serialNumber } from '@/lib/utils';
import { COLUMN_RESIZE, ROW_ACTIONS, SERIAL_COLUMN } from '@/constants/ui';
import { useColumnResize, type ColumnResize } from '@/hooks/useColumnResize';
import type { PageMeta } from '@/types';
import { Button, Card, Checkbox, NativeSelect } from './ui/primitives';
import { EmptyState, ErrorState } from './common';
import { Dialog, DialogBody, DialogContent, DialogHeader } from './ui/overlays';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Read-only rendering for the View dialog, when `cell` holds controls (switches, buttons). */
  viewCell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  /** Extra classes for a row, e.g. to highlight a kind of record. */
  rowClassName?: (row: T) => string | undefined;
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
  /** Show the leading S.No. column (default true). Numbers continue across pages when `meta` is given. */
  showSerial?: boolean;
}

const PAGE_SIZES = [10, 20, 50, 100];

/** Opens the surrounding table row in the read-only View dialog. */
const RowViewContext = React.createContext<(() => void) | undefined>(undefined);

/**
 * Icon buttons for a table row's Actions column. Pass only the handlers the user may run;
 * missing handlers hide their button. Clicks never trigger the row's own onRowClick.
 * Inside a DataTable, View is always offered: without `onView` it shows the row's details in a dialog.
 */
export const RowActions = ({ onView, onDownload, onEdit, onCancel, onDelete }: { onView?: () => void; onDownload?: () => void; onEdit?: () => void; onCancel?: () => void; onDelete?: () => void }) => {
  const showDetails = React.useContext(RowViewContext);
  const items: Array<{ key: string; label: string; icon: React.ReactNode; onClick?: () => void }> = [
    { key: 'download', label: ROW_ACTIONS.DOWNLOAD, icon: <Download />, onClick: onDownload },
    { key: 'view', label: ROW_ACTIONS.VIEW, icon: <Eye />, onClick: onView ?? showDetails },
    { key: 'edit', label: ROW_ACTIONS.EDIT, icon: <Pencil />, onClick: onEdit },
    { key: 'cancel', label: ROW_ACTIONS.CANCEL, icon: <XCircle className="text-amber-600" />, onClick: onCancel },
    { key: 'delete', label: ROW_ACTIONS.DELETE, icon: <Trash2 className="text-red-500" />, onClick: onDelete },
  ];
  return (
    <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {items
        .filter((i) => i.onClick)
        .map((i) => (
          <Button key={i.key} type="button" variant="ghost" size="icon-sm" aria-label={i.label} title={i.label} onClick={i.onClick}>
            {i.icon}
          </Button>
        ))}
    </div>
  );
};

/**
 * Divider on the right edge of a header cell: drag to resize the column, arrow keys when focused,
 * double-click to reset all widths. The parent <th> must be `relative`.
 */
export const ColumnResizer = ({ index, resize }: { index: number; resize: ColumnResize }) => (
  <span
    role="separator"
    aria-orientation="vertical"
    aria-label={COLUMN_RESIZE.HANDLE_LABEL}
    title={COLUMN_RESIZE.HANDLE_LABEL}
    tabIndex={0}
    onPointerDown={(e) => resize.startResize(index, e)}
    onKeyDown={(e) => resize.resizeByKey(index, e)}
    onDoubleClick={resize.reset}
    onClick={(e) => e.stopPropagation()}
    className="group/resizer absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none justify-center outline-none"
  >
    <span className="my-auto h-5 w-px bg-slate-300 transition-colors group-hover/resizer:h-full group-hover/resizer:w-0.5 group-hover/resizer:bg-brand-blue group-focus-visible/resizer:h-full group-focus-visible/resizer:w-0.5 group-focus-visible/resizer:bg-brand-blue" />
  </span>
);

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
  showSerial = true,
  rowClassName,
}: DataTableProps<T>) {
  const keys = (rows ?? []).map(rowKey);
  const [viewing, setViewing] = React.useState<T | null>(null);
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
  const leading = (selectable ? 1 : 0) + (showSerial ? 1 : 0);
  const resize = useColumnResize(`${leading}|${columns.map((c) => c.key).join(',')}`);
  /** Index of the data column `i` among all header cells (after checkbox / S.No.). */
  const cellIndex = (i: number) => leading + i;
  const cellPad = dense ? 'px-4 py-2.5' : 'px-4 py-3.5';
  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <Card className={cn('overflow-hidden', className)}>
      {toolbar && <div className="border-b px-4 py-3">{toolbar}</div>}
      <div className="scrollbar-thin relative overflow-x-auto">
        <table ref={resize.tableRef} style={resize.tableStyle} className={cn(
            'w-full min-w-[720px] border-collapse text-[13.5px]',
            resize.widths
              ? '[&_td]:overflow-hidden [&_td]:text-ellipsis'
              : // Phones/tablets: columns take their natural width and the table scrolls sideways, instead of
                // squeezing every column and wrapping text into tall rows.
                'max-lg:w-max max-lg:min-w-full max-lg:[&_td]:whitespace-nowrap max-lg:[&_th]:whitespace-nowrap',
          )}>
          <thead>
            <tr className="border-b bg-slate-50/80">
              {selectable && (
                <th className="w-10 px-4 py-3" style={resize.cellStyle(0)}>
                  <Checkbox checked={!!allSelected} onCheckedChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {showSerial && (
                <th scope="col" style={resize.cellStyle(selectable ? 1 : 0)} className={cn('relative px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500', SERIAL_COLUMN.CLASS)}>
                  {SERIAL_COLUMN.HEADER}
                  <ColumnResizer index={selectable ? 1 : 0} resize={resize} />
                </th>
              )}
              {columns.map((c, i) => {
                const active = sortBy === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={resize.cellStyle(cellIndex(i))}
                    className={cn('relative whitespace-nowrap px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500', alignCls(c.align), c.headerClassName)}
                  >
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(c.key)} className={cn('inline-flex items-center gap-1 uppercase transition-colors hover:text-brand-blue', active && 'text-brand-blue')}>
                        {c.header}
                        {active ? sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                    {i < columns.length - 1 && <ColumnResizer index={cellIndex(i)} resize={resize} />}
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
                  {showSerial && (
                    <td className={cellPad}>
                      <div className="skeleton mx-auto h-4 w-6" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cellPad}>
                      <div className="skeleton h-4" style={{ width: `${55 + ((i * 17 + c.key.length * 7) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              !error &&
              rows?.map((row, index) => {
                const k = rowKey(row);
                const isSel = selected?.has(k);
                return (
                  <tr
                    key={k}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('border-b transition-colors duration-micro last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-blue-50/40', isSel && 'bg-brand-blue-50/60', rowClassName?.(row))}
                  >
                    {selectable && (
                      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={!!isSel} onCheckedChange={() => toggle(k)} aria-label="Select row" />
                      </td>
                    )}
                    {showSerial && (
                      <td className={cn(cellPad, 'align-middle', SERIAL_COLUMN.CLASS, SERIAL_COLUMN.CELL_TEXT)}>{serialNumber(index, meta?.page, meta?.pageSize)}</td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn(cellPad, 'align-middle', alignCls(c.align), c.className)}>
                        <RowViewContext.Provider value={() => setViewing(row)}>{c.cell(row)}</RowViewContext.Provider>
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
              <NativeSelect aria-label="Rows per page" className="!h-8 w-[108px] text-xs" value={meta.pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
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
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent size="lg">
          <DialogHeader title={ROW_ACTIONS.VIEW_TITLE} />
          <DialogBody>
            {viewing !== null && (
              // Disabled fieldset: nothing in the details can be changed from here.
              <fieldset disabled className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {columns
                  .filter((c) => !c.key.startsWith('action'))
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{c.header}</p>
                      <div className="mt-1 break-words text-[13.5px] text-brand-navy">{(c.viewCell ?? c.cell)(viewing)}</div>
                    </div>
                  ))}
              </fieldset>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
