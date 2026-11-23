/**
 * Technician availability (cards) and staff schedule (day timeline) for a chosen date.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, HardHat, MapPin, Phone } from 'lucide-react';
import { useTechAvailability } from '@/hooks/useOperations';
import { useBranchScope } from '@/hooks/useBranchScope';
import { ROUTES } from '@/constants/routes';
import { cn, toYmd } from '@/lib/utils';
import { Badge, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge } from '@/components/common';
import { Button, Card, Input } from '@/components/ui/primitives';

export default function TechBoardPage({ mode }: { mode: 'availability' | 'schedule' }) {
  const navigate = useNavigate();
  const { branchId } = useBranchScope();
  const [date, setDate] = useState(toYmd(new Date()));
  const { data, isLoading, error, refetch } = useTechAvailability({ date, branchId });
  const shift = (n: number) => setDate(toYmd(addDays(parseISO(date), n)));
  const title = mode === 'availability' ? 'Technician Availability' : 'Staff Schedule';

  return (
    <>
      <PageHeader
        title={title}
        description={mode === 'availability' ? 'Who is free, busy or off — with skills and coverage.' : 'Each technician’s jobs for the day in time order.'}
        breadcrumbs={[{ label: 'Assignments', to: ROUTES.ASSIGNMENTS }, { label: title }]}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => shift(-1)}><ChevronLeft /></Button>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" aria-label="Date" />
            <Button variant="outline" size="icon" aria-label="Next day" onClick={() => shift(1)}><ChevronRight /></Button>
            <Button variant="ghost" onClick={() => setDate(toYmd(new Date()))}>Today</Button>
          </div>
        }
      />
      <p className="mb-4 font-display text-[15px] font-bold text-brand-navy">{format(parseISO(date), 'EEEE, dd MMMM yyyy')}</p>
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <Card><EmptyState icon={HardHat} title="No technicians" description="Add technicians in Master Data → Staff Management." /></Card>
      ) : mode === 'availability' ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((t) => {
            const state = !t.isAvailable ? 'off' : t.jobsOnDate >= 4 ? 'busy' : t.jobsOnDate > 0 ? 'partial' : 'free';
            return (
              <Card key={t.staffId} className="p-5">
                <div className="flex items-start gap-3">
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-full font-bold text-white', state === 'free' ? 'bg-brand-green-500' : state === 'off' ? 'bg-slate-400' : state === 'busy' ? 'bg-red-500' : 'bg-amber-500')}>
                    {t.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-navy">{t.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {t.mobile} · {t.staffCode}</p>
                  </div>
                  <Badge tone={state === 'free' ? 'green' : state === 'off' ? 'neutral' : state === 'busy' ? 'red' : 'amber'}>{state === 'free' ? 'Free' : state === 'off' ? 'Unavailable' : state === 'busy' ? 'Fully booked' : 'Partially booked'}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Jobs today" value={t.jobsOnDate} />
                  <Metric label="Active now" value={t.activeJobs} />
                  <Metric label="Shift" value={`${t.workStartTime}–${t.workEndTime}`} />
                </div>
                {t.skills.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{t.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}</div>}
                {t.serviceAreas.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {t.serviceAreas.join(', ')}</p>}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((t) => (
            <Card key={t.staffId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="w-56 shrink-0">
                <p className="font-semibold text-brand-navy">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.workStartTime}–{t.workEndTime} · {t.jobsOnDate} job(s)</p>
              </div>
              <div className="scrollbar-thin flex flex-1 gap-2 overflow-x-auto pb-1">
                {!t.jobs.length && <span className="rounded-lg border border-dashed px-4 py-2.5 text-[13px] text-muted-foreground">No jobs scheduled</span>}
                {t.jobs
                  .slice()
                  .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
                  .map((j) => (
                    <button key={j.id} type="button" onClick={() => navigate(ROUTES.BOOKING_DETAIL(j.id))} className="min-w-[190px] rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40">
                      <p className="num text-xs font-bold text-brand-blue">{j.scheduledTime ?? 'Any time'}</p>
                      <p className="truncate text-[13px] font-semibold text-brand-navy">{j.customer}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{j.bookingNumber}</span>
                        <StatusBadge status={j.status} />
                      </div>
                    </button>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg bg-slate-50 px-2 py-2">
    <p className="num font-display text-[15px] font-bold text-brand-navy">{value}</p>
    <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
  </div>
);
