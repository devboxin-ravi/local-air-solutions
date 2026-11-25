/**
 * Presentational pieces for the service form: duration picker, pricing-type cards and a
 * ₹-prefixed input. UI only — props in, callbacks out.
 */

import React from 'react';
import { DURATION_PRESETS, PRICING_TYPE_HINTS } from '@/constants/ui';
import { cn, formatDuration } from '@/lib/utils';
import { Input } from '@/components/ui/primitives';

// ─── Duration: number input + quick chips ───
export function DurationPicker({ value, onChange, invalid, inputProps }: { value: number; onChange: (minutes: number) => void; invalid?: boolean; inputProps: React.InputHTMLAttributes<HTMLInputElement> }) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input type="number" min={10} step={5} aria-invalid={invalid} className="pr-24" {...inputProps} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">min · {formatDuration(value)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
              Number(value) === m ? 'border-brand-blue bg-brand-blue text-white' : 'bg-white text-slate-600 hover:border-brand-blue-200 hover:text-brand-blue',
            )}
          >
            {formatDuration(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing type as selectable cards ───
export function PricingTypeCards({ options, value, onChange }: { options: ReadonlyArray<{ value: string; label: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all',
              on ? 'border-brand-blue bg-brand-blue-50/60 ring-1 ring-brand-blue' : 'bg-white hover:border-brand-blue-200',
            )}
          >
            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand-blue' : 'border-slate-300')}>
              {on && <span className="h-2 w-2 rounded-full bg-brand-blue" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-brand-navy">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{PRICING_TYPE_HINTS[o.value]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Input with a leading symbol (e.g. ₹) ───
export const PrefixInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { prefix: string }>(({ prefix, className, ...props }, ref) => (
  <div className="relative">
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted-foreground">{prefix}</span>
    <Input ref={ref} className={cn('pl-8', className)} {...props} />
  </div>
));
PrefixInput.displayName = 'PrefixInput';
