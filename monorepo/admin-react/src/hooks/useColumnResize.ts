/**
 * Drag-to-resize table columns. Logic and state only — the table renders the handles.
 *
 * Widths start as `null` (the browser's auto layout). The first drag snapshots every header
 * cell's rendered width, then only the dragged column changes; the table switches to a fixed
 * layout so the other columns keep their width. Wider than the card → it scrolls sideways;
 * narrower → the last column fills the gap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { COLUMN_RESIZE } from '@/constants/ui';

export interface ColumnResize {
  tableRef: React.RefObject<HTMLTableElement>;
  /** Per header-cell widths (px), or null while the table uses its natural layout. */
  widths: number[] | null;
  /** Inline style for the <table>: fixed layout at the summed width once resized. */
  tableStyle: React.CSSProperties | undefined;
  /** Inline style for header cell `index` (counting every <th>, including checkbox / S.No.). */
  cellStyle: (index: number) => React.CSSProperties | undefined;
  /** Pointer-down handler for the resize handle of header cell `index`. */
  startResize: (index: number, e: React.PointerEvent) => void;
  /** Keyboard resizing for a focused handle (ArrowLeft / ArrowRight). */
  resizeByKey: (index: number, e: React.KeyboardEvent) => void;
  /** Back to natural widths. */
  reset: () => void;
}

/** `layoutKey` should change when the set of columns changes, so stale widths are dropped. */
export function useColumnResize(layoutKey: string): ColumnResize {
  const tableRef = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => setWidths(null), [layoutKey]);
  useEffect(() => () => cleanup.current?.(), []);

  /** Current widths, or the rendered header widths when nothing has been resized yet. */
  const measure = useCallback((): number[] => {
    if (widths) return widths;
    const cells = tableRef.current?.tHead?.rows[0]?.cells;
    return cells ? Array.from(cells, (c) => c.getBoundingClientRect().width) : [];
  }, [widths]);

  const startResize = useCallback(
    (index: number, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const base = measure();
      if (base[index] === undefined) return;
      const startX = e.clientX;
      const startWidth = base[index];

      const onMove = (ev: PointerEvent) => {
        const next = [...base];
        next[index] = Math.max(COLUMN_RESIZE.MIN_WIDTH, Math.round(startWidth + ev.clientX - startX));
        setWidths(next);
      };
      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        cleanup.current = null;
      };
      cleanup.current?.();
      cleanup.current = stop;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [measure],
  );

  const resizeByKey = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = [...measure()];
      if (next[index] === undefined) return;
      next[index] = Math.max(COLUMN_RESIZE.MIN_WIDTH, next[index] + dir * COLUMN_RESIZE.KEY_STEP);
      setWidths(next);
    },
    [measure],
  );

  const reset = useCallback(() => setWidths(null), []);

  // Never narrower than the card: the last column stays auto-width and absorbs any spare space.
  const tableStyle = widths ? { tableLayout: 'fixed' as const, width: `max(100%, ${widths.reduce((sum, w) => sum + w, 0)}px)` } : undefined;
  const cellStyle = useCallback(
    (index: number) => (widths && index < widths.length - 1 && widths[index] !== undefined ? { width: widths[index] } : undefined),
    [widths],
  );

  return { tableRef, widths, tableStyle, cellStyle, startResize, resizeByKey, reset };
}
