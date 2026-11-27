/**
 * Picker components (customer search combobox, searchable select, slot grid, chip multi-select). UI only.
 */

import * as React from 'react';
import { Check, ChevronDown, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Customer, Slot } from '@/types';
import { SearchBox } from './ui/primitives';
import { CUSTOMER_PICKER, SEARCHABLE_SELECT } from '@/constants/ui';
import { Combobox, optionMatches, type ComboOption } from './ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/overlays';

/** Customer search: type a name, mobile or ID straight into the field; results come from the server. */
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
  const comboOptions = options.map<ComboOption>((c) => ({
    value: String(c.id),
    label: c.fullName,
    hint: `${c.customerCode} · ${c.mobile}${c.addresses[0]?.city?.name ? ` · ${c.addresses[0].city.name}` : ''}`,
  }));
  return (
    <Combobox
      options={comboOptions}
      value={value ? String(value.id) : null}
      selectedLabel={value ? `${value.fullName} · ${value.customerCode} · ${value.mobile}` : undefined}
      query={search}
      onQueryChange={onSearchChange}
      onSelect={(o) => {
        const c = options.find((x) => String(x.id) === o.value);
        if (c) onSelect(c);
      }}
      loading={loading}
      invalid={invalid}
      placeholder={CUSTOMER_PICKER.PLACEHOLDER}
      emptyText={CUSTOMER_PICKER.EMPTY_TEXT}
      aria-label={CUSTOMER_PICKER.PLACEHOLDER}
      leadingIcon={<UserRound />}
      className="h-11"
    />
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

/** Value used for the optional "no selection" row. */
const NONE = '';

/**
 * Number-valued searchable dropdown (services, technicians…): type straight into the field.
 * `noneLabel` adds a first "no selection" row; `resetOnSelect` keeps the field empty after
 * picking (for "add item" pickers).
 */
export const SearchSelect = ({
  id,
  options,
  value,
  onChange,
  placeholder = SEARCHABLE_SELECT.SELECT_PLACEHOLDER,
  emptyText = SEARCHABLE_SELECT.EMPTY_TEXT,
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
  /** Kept for API compatibility; the field itself is the search box. */
  searchPlaceholder?: string;
  emptyText?: string;
  noneLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  resetOnSelect?: boolean;
  className?: string;
}) => {
  const comboOptions = React.useMemo<ComboOption[]>(
    () => [
      ...(noneLabel && !resetOnSelect ? [{ value: NONE, label: noneLabel, muted: true }] : []),
      ...options.map((o) => ({ value: String(o.value), label: o.label, hint: o.hint, meta: o.meta })),
    ],
    [options, noneLabel, resetOnSelect],
  );
  return (
    <Combobox
      id={id}
      options={comboOptions}
      value={value == null ? (noneLabel ? NONE : null) : String(value)}
      onSelect={(o) => onChange(o.value === NONE ? null : Number(o.value))}
      placeholder={loading ? SEARCHABLE_SELECT.LOADING_TEXT : placeholder}
      emptyText={emptyText}
      loading={loading}
      disabled={disabled}
      resetOnSelect={resetOnSelect}
      showFooter
      className={className}
    />
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
  const shown = query.trim() ? options.filter((o) => optionMatches({ label: o.name }, query)) : options;
  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox wrapperClassName="sm:max-w-xs sm:flex-1" value={query} onValueChange={setQuery} aria-label="Search options" />
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

/**
 * Multi-select dropdown: chosen items show as removable tags in the field; the menu has a search
 * box and a checkbox per option. Same value shape as ChipMultiSelect (ids).
 */
export const MultiSelectDropdown = ({
  options,
  value,
  onChange,
  placeholder = SEARCHABLE_SELECT.SELECT_PLACEHOLDER,
  emptyText = SEARCHABLE_SELECT.EMPTY_TEXT,
  invalid,
  id,
}: {
  options: Array<{ id: number; name: string; hint?: string }>;
  value: number[];
  onChange: (v: number[]) => void;
  placeholder?: string;
  emptyText?: string;
  invalid?: boolean;
  id?: string;
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = options.filter((o) => value.includes(o.id));
  const shown = query.trim() ? options.filter((o) => optionMatches({ label: o.name, hint: o.hint }, query)) : options;
  const toggle = (oid: number) => onChange(value.includes(oid) ? value.filter((v) => v !== oid) : [...value, oid]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <div
          id={id}
          role="combobox"
          tabIndex={0}
          aria-expanded={open}
          aria-invalid={invalid}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && (e.preventDefault(), setOpen(true))}
          className={cn(
            'flex min-h-control w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none transition-colors hover:border-brand-blue-300 focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue-100 focus-visible:ring-offset-0',
            open && 'border-brand-blue ring-2 ring-brand-blue-100',
            invalid && 'border-destructive',
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selected.length === 0 && <span className="px-0.5 text-slate-400">{placeholder}</span>}
            {selected.map((o) => (
              <span key={o.id} className="inline-flex items-center gap-1 rounded-md bg-brand-blue-50 py-0.5 pl-2 pr-1 text-[12.5px] font-semibold text-brand-blue ring-1 ring-brand-blue-100">
                {o.name}
                <button
                  type="button"
                  aria-label={`Remove ${o.name}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.id);
                  }}
                  className="rounded p-0.5 text-brand-blue/70 hover:bg-brand-blue-100 hover:text-brand-blue"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1.5">
        <SearchBox autoFocus wrapperClassName="mb-1.5" value={query} onValueChange={setQuery} />
        <div role="listbox" aria-multiselectable className="scrollbar-thin max-h-64 overflow-y-auto">
          {shown.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>}
          {shown.map((o) => {
            const on = value.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.id)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', on ? 'bg-brand-blue-50/60' : 'hover:bg-slate-50')}
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white')}>
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13.5px]', on ? 'font-semibold text-brand-navy' : 'text-slate-700')}>{o.name}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {options.length > 0 && (
          <div className="mt-1 flex items-center justify-between border-t px-2 pt-1.5 text-[11.5px] text-muted-foreground">
            <span>{value.length} selected</span>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="font-semibold text-brand-blue hover:underline">
                Clear
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
