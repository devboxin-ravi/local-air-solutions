/**
 * Combobox: the field itself is the search box. Click or focus it and type — the current value
 * shows as the placeholder while you search, matches open below, ↑/↓ move, Enter picks, Esc closes.
 * UI only: options in, `onSelect` out. Filtering is local unless the parent controls `query`
 * (server-side search, e.g. customers).
 */

import * as React from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEARCHABLE_SELECT } from '@/constants/ui';
import { Popover, PopoverAnchor, PopoverContent } from './overlays';

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary line under the label (searchable too), e.g. a code or mobile. */
  hint?: string;
  /** Right-aligned text, e.g. a price. */
  meta?: string;
  disabled?: boolean;
  /** Placeholder-style row such as "All categories". */
  muted?: boolean;
}

export interface ComboboxProps {
  options: ComboOption[];
  /** Selected option value (null/undefined = nothing selected). */
  value?: string | null;
  /** Text for the selected value when it is not in `options` (e.g. a customer from another search). */
  selectedLabel?: string;
  onSelect: (option: ComboOption) => void;
  /** Controlled search text: the parent filters/fetches `options`. Omit for local filtering. */
  query?: string;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Classes for the input (size, shape, padding). */
  className?: string;
  /** Icon shown inside the field on the left. */
  leadingIcon?: React.ReactNode;
  /** Show "n of m · ↑↓ Enter" under the list. */
  showFooter?: boolean;
  /** Keep the field empty after picking (for "add item" pickers). */
  resetOnSelect?: boolean;
}

/** Case-insensitive: every typed word must appear in the label or hint. */
export const optionMatches = (o: Pick<ComboOption, 'label' | 'hint'>, query: string) => {
  const haystack = `${o.label} ${o.hint ?? ''}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => haystack.includes(w));
};

/** Layout classes (width, flex sizing, grid span) belong on the wrapper; everything else styles the input. */
const LAYOUT_CLASS = /^(?:[a-z0-9]+:)*(?:w-|min-w-|max-w-|flex-|basis-|grow|shrink|self-|col-span-|order-)/;
const splitClasses = (className?: string) => {
  const tokens = (className ?? '').split(/\s+/).filter(Boolean);
  return { wrapper: tokens.filter((t) => LAYOUT_CLASS.test(t)).join(' '), input: tokens.filter((t) => !LAYOUT_CLASS.test(t)).join(' ') };
};

export const Combobox = ({
  options,
  value,
  selectedLabel,
  onSelect,
  query: controlledQuery,
  onQueryChange,
  placeholder = SEARCHABLE_SELECT.SELECT_PLACEHOLDER,
  emptyText = SEARCHABLE_SELECT.EMPTY_TEXT,
  loading,
  disabled,
  invalid,
  id,
  'aria-label': ariaLabel,
  className,
  leadingIcon,
  showFooter,
  resetOnSelect,
}: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);
  const [localQuery, setLocalQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const autoId = React.useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-listbox`;

  const classes = splitClasses(className);
  const controlled = controlledQuery !== undefined;
  const query = controlled ? controlledQuery : localQuery;
  const setQuery = (q: string) => (controlled ? onQueryChange?.(q) : setLocalQuery(q));

  const selected = resetOnSelect ? undefined : options.find((o) => o.value === value);
  // A muted row ("All categories") is shown as the grey placeholder, not as typed-in text.
  const shownLabel = resetOnSelect ? '' : selected ? (selected.muted ? '' : selected.label) : value ? selectedLabel ?? '' : '';

  const filtered = React.useMemo(
    () => (controlled || !query.trim() ? options : options.filter((o) => !o.muted && optionMatches(o, query))),
    [controlled, options, query],
  );

  React.useEffect(() => {
    if (!open) return;
    const i = filtered.findIndex((o) => o.value === value);
    setActive(i >= 0 && !query ? i : 0);
    // Only when the list opens or its contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered]);
  React.useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    if (!controlled) setLocalQuery('');
  };
  const pick = (o: ComboOption) => {
    if (o.disabled) return;
    onSelect(o);
    close();
    if (resetOnSelect) setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(i + 1, filtered.length - 1) : Math.max(i - 1, 0)));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab' && open) {
      close();
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? openList() : close())}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn('relative w-full', classes.wrapper)}>
          {leadingIcon && <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{leadingIcon}</span>}
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${baseId}-opt-${active}` : undefined}
            aria-invalid={invalid}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            value={open ? query : shownLabel}
            placeholder={open ? shownLabel || placeholder : placeholder}
            // Opens on click, typing or ArrowDown — not on focus, so a dialog that auto-focuses this
            // field doesn't pop the list open over the form the moment it appears.
            onClick={openList}
            onChange={(e) => {
              if (!open) setOpen(true);
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className={cn(
              'h-control w-full cursor-pointer truncate rounded-lg border border-input bg-white pr-9 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] duration-micro placeholder:text-slate-400 hover:border-brand-blue-300 focus:cursor-text focus:border-brand-blue focus:shadow-[0_0_0_3px] focus:shadow-brand-blue-100 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted aria-[invalid=true]:border-destructive',
              leadingIcon ? 'pl-9' : 'pl-3',
              classes.input,
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popper-anchor-width)] min-w-[220px] p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div ref={listRef} id={listId} role="listbox" className="scrollbar-thin max-h-72 overflow-y-auto">
          {loading && filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{SEARCHABLE_SELECT.LOADING_TEXT}</p>}
          {!loading && filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>}
          {filtered.map((o, i) => {
            const isSelected = !resetOnSelect && o.value === value;
            return (
              <button
                key={`${o.value}-${i}`}
                id={`${baseId}-opt-${i}`}
                data-index={i}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                disabled={o.disabled}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  i === active ? 'bg-brand-blue-50' : 'hover:bg-slate-50',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13.5px]', o.muted ? 'text-slate-500' : isSelected ? 'font-semibold text-brand-navy' : 'text-slate-700')}>{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.meta && <span className="num shrink-0 text-xs font-semibold text-slate-600">{o.meta}</span>}
                {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-blue" />}
              </button>
            );
          })}
        </div>
        {showFooter && options.length > 0 && (
          <p className="mt-1 border-t px-2 pt-1.5 text-[11px] text-muted-foreground">
            {query.trim() ? `${filtered.length} of ${options.length}` : `${options.length} options`} · ↑↓ to move, Enter to select
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};
