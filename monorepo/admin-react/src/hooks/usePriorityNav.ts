/**
 * Priority+ navigation: decides how many nav items fit in the available width.
 * Items that don't fit are moved to a "More" menu by the caller.
 *
 * The caller renders an invisible "measure" row containing every item followed by the
 * More trigger (same classes as the real row), and attaches `measureRef` to it and
 * `containerRef` to the element whose width is the space available. Logic only, no JSX.
 */

import { useLayoutEffect, useRef, useState } from 'react';

export function usePriorityNav(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(itemCount);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const nodes = Array.from(measure.children) as HTMLElement[];
      if (nodes.length < itemCount + 1) return;
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      const widths = nodes.slice(0, itemCount).map((n) => n.getBoundingClientRect().width);
      const moreWidth = nodes[itemCount].getBoundingClientRect().width;
      const available = container.clientWidth;

      const total = widths.reduce((sum, w, i) => sum + w + (i ? gap : 0), 0);
      if (total <= available) {
        setVisibleCount(itemCount);
        return;
      }
      // Fit as many as possible while leaving room for the More trigger.
      let used = moreWidth;
      let count = 0;
      for (const w of widths) {
        if (used + gap + w > available) break;
        used += gap + w;
        count += 1;
      }
      setVisibleCount(count);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    observer.observe(measure); // re-measure when web fonts finish loading
    return () => observer.disconnect();
  }, [itemCount]);

  return { containerRef, measureRef, visibleCount };
}
