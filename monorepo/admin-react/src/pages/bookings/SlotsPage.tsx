/**
 * Slot management: generate from working hours, adjust capacity, deactivate.
 */

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarRange, Power, Trash2, Wand2 } from 'lucide-react';
import { useSlotActions, useSlots } from '@/hooks/useOperations';
import { useBranches } from '@/hooks/useApi';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { WEEKDAYS } from '@/constants/ui';
import { cn, toYmd } from '@/lib/utils';
import type { Slot } from '@/types';
import { EmptyState, ErrorState, Field, LoadingBlock, PageHeader } from '@/components/common';
import { DateRange } from '@/components/Filters';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

export default function SlotsPage() {
  const { can } = useAuth();
  const { branchId: globalBranch } = useBranchScope();
  const { data: branches } = useBranches({ activeOnly: true });
  const [branchId, setBranchId] = useState<number | undefined>(globalBranch);
  const effectiveBranch = branchId ?? branches?.[0]?.id;
  const [range, setRange] = useState({ from: toYmd(new Date()), to: toYmd(new Date(Date.now() + 13 * 86_400_000)) });
  const { data, isLoading, error, refetch } = useSlots({ branchId: effectiveBranch, ...range });
  const actions = useSlotActions();
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ fromDate: range.from, toDate: toYmd(new Date(Date.now() + 29 * 86_400_000)), startTime: '09:00', endTime: '19:00', slotDurationMinutes: 120, capacity: 3, workingDays: [1, 2, 3, 4, 5, 6] });

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    (data ?? []).forEach((s) => m.set(s.slotDate, [...(m.get(s.slotDate) ?? []), s]));
    return Array.from(m.entries());
  }, [data]);

  return (
    <>
      <PageHeader
        title="Slot Management"
        description="Appointment capacity per branch. Bookings reserve slots atomically — a full slot can never be double-booked."
        breadcrumbs={[{ label: 'Bookings', to: ROUTES.BOOKINGS }, { label: 'Slot Management' }]}
        actions={can('slots.create') && <Button onClick={() => setGenOpen(true)} disabled={!effectiveBranch}><Wand2 /> Generate slots</Button>}
      />
      <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <NativeSelect aria-label="Branch" value={effectiveBranch ?? ''} onChange={(e) => setBranchId(Number(e.target.value) || undefined)} className="sm:w-56">
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
        <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
      </Card>

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !byDate.length ? (
        <Card>
          <EmptyState icon={CalendarRange} title="No slots in this range" description="Generate slots from your working hours to start accepting scheduled bookings." action={can('slots.create') && <Button onClick={() => setGenOpen(true)}><Wand2 /> Generate slots</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {byDate.map(([date, slots]) => (
            <Card key={date} className="p-4">
              <p className="mb-3 font-display font-bold text-brand-navy">{format(parseISO(date), 'EEE, dd MMM yyyy')}</p>
              <ul className="space-y-2">
                {slots.map((s) => {
                  const pct = s.capacity ? Math.round((s.bookedCount / s.capacity) * 100) : 100;
                  return (
                    <li key={s.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', !s.isActive && 'bg-slate-50 opacity-60')}>
                      <span className="num w-24 text-[13px] font-semibold">{s.startTime}–{s.endTime}</span>
                      <div className="flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct >= 66 ? 'bg-amber-500' : 'bg-brand-green-500')} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <p className="num mt-1 text-[11.5px] text-muted-foreground">{s.bookedCount}/{s.capacity} booked</p>
                      </div>
                      {can('slots.edit') && (
                        <>
                          <Input type="number" min={s.bookedCount} max={100} defaultValue={s.capacity} aria-label="Capacity" className="h-8 w-16 text-center" onBlur={(e) => Number(e.target.value) !== s.capacity && actions.update.mutate({ id: s.id, body: { capacity: Number(e.target.value) } })} />
                          <Button variant="ghost" size="icon-sm" aria-label={s.isActive ? 'Deactivate slot' : 'Activate slot'} onClick={() => actions.update.mutate({ id: s.id, body: { isActive: !s.isActive } })}>
                            <Power className={s.isActive ? 'text-brand-green-600' : ''} />
                          </Button>
                        </>
                      )}
                      {can('slots.delete') && s.bookedCount === 0 && (
                        <Button variant="ghost" size="icon-sm" aria-label="Delete slot" onClick={() => actions.remove.mutate(s.id)}>
                          <Trash2 className="text-red-500" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader title="Generate slots" description={`Branch: ${branches?.find((b) => b.id === effectiveBranch)?.name ?? ''}. Existing slots are kept.`} />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="From"><Input type="date" value={gen.fromDate} onChange={(e) => setGen({ ...gen, fromDate: e.target.value })} /></Field>
            <Field label="To" hint="Max 60 days"><Input type="date" value={gen.toDate} min={gen.fromDate} onChange={(e) => setGen({ ...gen, toDate: e.target.value })} /></Field>
            <Field label="Start time"><Input type="time" value={gen.startTime} onChange={(e) => setGen({ ...gen, startTime: e.target.value })} /></Field>
            <Field label="End time"><Input type="time" value={gen.endTime} onChange={(e) => setGen({ ...gen, endTime: e.target.value })} /></Field>
            <Field label="Slot length (minutes)"><Input type="number" min={30} max={480} step={30} value={gen.slotDurationMinutes} onChange={(e) => setGen({ ...gen, slotDurationMinutes: Number(e.target.value) })} /></Field>
            <Field label="Max jobs per slot"><Input type="number" min={1} max={100} value={gen.capacity} onChange={(e) => setGen({ ...gen, capacity: Number(e.target.value) })} /></Field>
            <Field label="Working days" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => {
                  const on = gen.workingDays.includes(i);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => setGen({ ...gen, workingDays: on ? gen.workingDays.filter((x) => x !== i) : [...gen.workingDays, i] })} className={cn('h-9 w-12 rounded-lg border text-xs font-semibold', on ? 'border-brand-blue bg-brand-blue text-white' : 'bg-white text-slate-600')}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button loading={actions.generate.isPending} onClick={() => actions.generate.mutate({ branchId: effectiveBranch, ...gen }, { onSuccess: () => setGenOpen(false) })}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
