/**
 * Picker components (customer search combobox, searchable select, slot grid, chip multi-select). UI only.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Search, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Customer, Slot } from '@/types';
import { Input } from './ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from './ui/overlays';

export const CustomerPicker = ({
  value,
  options,
  search,
  onSearchChange,
  onSelect,
  loading,
  invalid,
}: {
  value?: Pick<Customer, 'id' | 'fullName' | 'mobile' | 'customerCode'> | null;
  options: Customer[];
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (c: Customer) => void;
  loading?: boolean;
  invalid?: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-invalid={invalid}
        className="flex h-11 w-full items-center gap-3 rounded-lg border border-input bg-white px-3 text-left text-sm shadow-sm transition-colors hover:border-brand-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-[invalid=true]:border-destructive"
      >
        <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
        {value ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-brand-navy">{value.fullName}</span>
            <span className="ml-2 text-muted-foreground">
              {value.customerCode} · {value.mobile}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-slate-400">Search customer by name, mobile or ID…</span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input autoFocus value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Type to search…" className="pl-9" />
        </div>
        <div className="scrollbar-thin max-h-64 overflow-y-auto">
          {loading && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Searching…</p>}
          {!loading && options.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No customers found.</p>}
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-brand-blue-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-brand-navy">{c.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.customerCode} · {c.mobile}
                  {c.addresses[0] ? ` · ${c.addresses[0].city?.name ?? ''}` : ''}
                </span>
              </span>
              {value?.id === c.id && <Check className="h-4 w-4 text-brand-blue" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export interface SearchOption {
  value: number;
  label: string;
  /** Secondary text under the label (also searchable), e.g. a code or category. */
  hint?: string;
  /** Right-aligned text, e.g. a price. */
  meta?: string;
}

/** Sentinel value for the optional "no selection" row. */
const NONE = -1;

/** Case-insensitive match on every typed word against label + hint. */
const matches = (o: Pick<SearchOption, 'label' | 'hint'>, query: string) => {
  const haystack = `${o.label} ${o.hint ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};

/**
 * Dropdown with type-to-search. Arrow keys move, Enter picks, Esc closes.
 * `noneLabel` adds a first "no selection" row; `resetOnSelect` keeps the trigger on the
 * placeholder after picking (for "add item" pickers).
 */
export const SearchSelect = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches',
  noneLabel,
  loading,
  disabled,
  resetOnSelect,
  className,
}: {
  id?: string;
  options: SearchOption[];
  value?: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  noneLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  resetOnSelect?: boolean;
  className?: string;
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const baseId = id ?? 'search-select';
  const selected = resetOnSelect ? undefined : options.find((o) => o.value === value);
  const showNone = !!noneLabel && value == null && !resetOnSelect;

  const filtered = React.useMemo(() => {
    const hits = query.trim() ? options.filter((o) => matches(o, query)) : options;
    return noneLabel && !query.trim() ? [{ value: NONE, label: noneLabel }, ...hits] : hits;
  }, [options, query, noneLabel]);

  React.useEffect(() => setActive(0), [query, open]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o: SearchOption) => {
    onChange(o.value === NONE ? null : o.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          'flex h-control w-full items-center gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm shadow-sm transition-colors hover:border-brand-blue-300 focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted data-[state=open]:border-brand-blue data-[state=open]:ring-2 data-[state=open]:ring-ring/30',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected || showNone ? 'text-foreground' : 'text-slate-400')}>
          {selected ? selected.label : loading ? 'Loading…' : showNone ? noneLabel : placeholder}
        </span>
        {selected?.meta && <span className="num shrink-0 text-xs text-muted-foreground">{selected.meta}</span>}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-2" onKeyDown={onKeyDown}>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={filtered[active] ? `${baseId}-opt-${active}` : undefined}
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div ref={listRef} id={`${baseId}-listbox`} role="listbox" className="scrollbar-thin max-h-72 overflow-y-auto">
          {filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>}
          {filtered.map((o, i) => {
            const isSelected = !resetOnSelect && (o.value === NONE ? value == null : o.value === value);
            return (
              <button
                key={o.value}
                id={`${baseId}-opt-${i}`}
                data-index={i}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', i === active ? 'bg-brand-blue-50' : 'hover:bg-slate-50')}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px]', o.value === NONE ? 'italic text-slate-500' : 'font-semibold text-brand-navy')}>{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.meta && <span className="num shrink-0 text-xs font-semibold text-slate-600">{o.meta}</span>}
                {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-blue" />}
              </button>
            );
          })}
        </div>
        {options.length > 0 && (
          <p className="mt-1.5 border-t px-1 pt-1.5 text-[11px] text-muted-foreground">
            {query.trim() ? `${filtered.length} of ${options.length}` : `${options.length} options`} · ↑↓ to move, Enter to select
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const SlotGrid = ({ slots, value, onChange, loading }: { slots: Slot[] | undefined; value?: number | null; onChange: (id: number | null) => void; loading?: boolean }) => {
  if (loading) return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14" />)}</div>;
  if (!slots?.length)
    return <p className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">No open slots for this date. The booking can still be created without a slot.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {slots.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(active ? null : s.id)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-all duration-micro',
              active ? 'border-brand-blue bg-brand-blue-50 ring-2 ring-brand-blue/20' : 'border-border bg-white hover:border-brand-blue-300',
            )}
          >
            <span className="num block text-[13.5px] font-bold text-brand-navy">
              {s.startTime} – {s.endTime}
            </span>
            <span className={cn('text-[11.5px] font-medium', s.available <= 1 ? 'text-amber-600' : 'text-brand-green-700')}>{s.available} left</span>
          </button>
        );
      })}
    </div>
  );
};

/** Chips get a search box once the list is this long. */
const CHIP_SEARCH_MIN = 10;

export const ChipMultiSelect = ({ options, value, onChange, emptyText = 'No options' }: { options: Array<{ id: number; name: string }>; value: number[]; onChange: (v: number[]) => void; emptyText?: string }) => {
  const [query, setQuery] = React.useState('');
  if (!options.length) return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  const searchable = options.length >= CHIP_SEARCH_MIN;
  const shown = query.trim() ? options.filter((o) => matches({ label: o.name }, query)) : options;
  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search…" className="pl-9" aria-label="Search options" />
          </div>
          <span className="text-xs text-muted-foreground">
            {value.length} selected{query.trim() ? ` · ${shown.length} of ${options.length} shown` : ''}
          </span>
        </div>
      )}
      {searchable && shown.length === 0 && <p className="text-[13px] text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>}
      <div className="flex flex-wrap gap-2">
      {shown.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-micro',
              on ? 'border-brand-blue bg-brand-blue text-white' : 'border-border bg-white text-slate-600 hover:border-brand-blue-300 hover:text-brand-blue',
            )}
          >
            {on && <Check className="h-3.5 w-3.5" />}
            {o.name}
          </button>
        );
      })}
      </div>
    </div>
  );
};
