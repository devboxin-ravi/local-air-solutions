/**
 * Picker components (customer search combobox, slot grid, chip multi-select). UI only.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Search, UserRound } from 'lucide-react';
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

export const ChipMultiSelect = ({ options, value, onChange, emptyText = 'No options' }: { options: Array<{ id: number; name: string }>; value: number[]; onChange: (v: number[]) => void; emptyText?: string }) => {
  if (!options.length) return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
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
  );
};
