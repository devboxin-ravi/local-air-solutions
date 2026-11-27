/**
 * Editor for the customer-app booking tracker: one row per step (show / short label / title / message)
 * plus a live preview of the stepper. UI only — props in, callbacks out.
 */

import { Check } from 'lucide-react';
import { PLACEHOLDERS, TRACKER } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { Input, Switch } from '@/components/ui/primitives';

export interface TrackerStepValue {
  status: string;
  visible: boolean;
  label: string;
  title: string;
  hint: string;
}

export interface TrackerStepsEditorProps {
  value: TrackerStepValue[];
  disabled?: boolean;
  /** Validation errors keyed like `steps.2.label`. */
  errors: Record<string, string | undefined>;
  /** Next steps array, plus the error key of the edited field so the caller can clear it. */
  onChange: (steps: TrackerStepValue[], editedKey: string) => void;
}

export function TrackerStepsEditor({ value, disabled, errors, onChange }: TrackerStepsEditorProps) {
  const update = (i: number, patch: Partial<TrackerStepValue>) => {
    const field = Object.keys(patch)[0];
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)), `steps.${i}.${field}`);
  };
  const visible = value.filter((s) => s.visible);
  const listError = errors.steps;

  return (
    <div className="space-y-5">
      {/* Live preview of the app stepper */}
      <div className="rounded-xl border bg-slate-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">App preview</p>
        <div className="flex items-start">
          {visible.map((s, i) => (
            <div key={s.status} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : 'bg-slate-200')} />
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', i === 0 ? 'bg-brand-blue text-white shadow' : 'bg-slate-200 text-slate-500')}>
                  {i === 0 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className={cn('h-0.5 flex-1', i === visible.length - 1 ? 'bg-transparent' : 'bg-slate-200')} />
              </div>
              <span className={cn('mt-1.5 w-full truncate text-center text-[11px] font-semibold', i === 0 ? 'text-brand-blue' : 'text-slate-500')}>{s.label || '—'}</span>
            </div>
          ))}
        </div>
        {visible[0] && (
          <div className="mt-3 rounded-lg bg-brand-blue-50 px-3 py-2">
            <p className="text-sm font-bold text-slate-900">{visible[0].title || '—'}</p>
            <p className="text-xs text-muted-foreground">{visible[0].hint || 'No message'}</p>
          </div>
        )}
      </div>

      {listError && <p className="text-sm text-destructive">{listError}</p>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Booking status</th>
              <th className="w-20 px-3 py-2.5">Show</th>
              <th className="w-40 px-3 py-2.5">Short label</th>
              <th className="w-56 px-3 py-2.5">Title</th>
              <th className="px-3 py-2.5">Message to customer</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {value.map((s, i) => {
              const required = (TRACKER.REQUIRED as readonly string[]).includes(s.status);
              const name = TRACKER.STEPS.find((x) => x.status === s.status)?.name ?? s.status;
              const err = (f: keyof TrackerStepValue) => errors[`steps.${i}.${f}`];
              return (
                <tr key={s.status} className={cn('align-top', !s.visible && 'bg-slate-50/70 text-muted-foreground')}>
                  <td className="px-3 py-3 font-semibold text-slate-500">{i + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{name}</p>
                    {required && <p className="text-xs text-muted-foreground">Always shown</p>}
                  </td>
                  <td className="px-3 py-3">
                    <Switch checked={s.visible} disabled={disabled || required} onCheckedChange={(c) => update(i, { visible: c })} aria-label={`Show ${name}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={s.label} placeholder={PLACEHOLDERS.TRACKER_LABEL} maxLength={TRACKER.LABEL_MAX} disabled={disabled} aria-invalid={!!err('label')} onChange={(e) => update(i, { label: e.target.value })} />
                    {err('label') && <p className="mt-1 text-xs text-destructive">{err('label')}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Input value={s.title} placeholder={PLACEHOLDERS.TRACKER_TITLE} maxLength={TRACKER.TITLE_MAX} disabled={disabled} aria-invalid={!!err('title')} onChange={(e) => update(i, { title: e.target.value })} />
                    {err('title') && <p className="mt-1 text-xs text-destructive">{err('title')}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Input value={s.hint} placeholder={PLACEHOLDERS.TRACKER_HINT} maxLength={TRACKER.HINT_MAX} disabled={disabled} aria-invalid={!!err('hint')} onChange={(e) => update(i, { hint: e.target.value })} />
                    {err('hint') && <p className="mt-1 text-xs text-destructive">{err('hint')}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Hidden steps are skipped in the app — while a booking is at a hidden status, the tracker stays on the previous visible step. Short labels appear under the icons; the title and message show for the current step.
      </p>
    </div>
  );
}
