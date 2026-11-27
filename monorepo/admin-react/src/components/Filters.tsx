/**
 * Filter toolbar building blocks: debounced search input, select filter, date range. UI only.
 */

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIMITS } from '@/constants/ui';
import { Input, NativeSelect } from './ui/primitives';

export const SearchInput = ({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  React.useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), LIMITS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [local, value, onChange]);
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className="pl-9 pr-8" maxLength={100} aria-label={placeholder} />
      {local && (
        <button type="button" onClick={() => { setLocal(''); onChange(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export interface Option {
  value: string | number;
  label: string;
}

/** `searchable` forces type-to-search (use it for lists that come from the database and keep growing). */
export const SelectFilter = ({ value, onChange, options, placeholder, className, ariaLabel, searchable }: { value: string | number | undefined; onChange: (v: string) => void; options: Option[]; placeholder: string; className?: string; ariaLabel?: string; searchable?: boolean }) => (
  <NativeSelect searchable={searchable} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cn('w-full sm:w-44', className)} aria-label={ariaLabel ?? placeholder}>
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </NativeSelect>
);

export const DateRange = ({ from, to, onChange }: { from?: string; to?: string; onChange: (from: string, to: string) => void }) => (
  // Phones: the two inputs share the row (flex-1, shrinkable) instead of fixed 150px boxes that overflow.
  <div className="flex w-full items-center gap-2 sm:w-auto">
    <Input type="date" value={from ?? ''} onChange={(e) => onChange(e.target.value, to ?? '')} className="min-w-0 flex-1 sm:w-[150px] sm:flex-none" aria-label="From date" />
    <span className="shrink-0 text-xs text-muted-foreground">to</span>
    <Input type="date" value={to ?? ''} min={from} onChange={(e) => onChange(from ?? '', e.target.value)} className="min-w-0 flex-1 sm:w-[150px] sm:flex-none" aria-label="To date" />
  </div>
);

export const FilterBar = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">{children}</div>
    {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
  </div>
);
