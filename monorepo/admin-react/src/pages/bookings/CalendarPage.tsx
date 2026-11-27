/**
 * Service calendar: month grid of scheduled bookings with a day agenda.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react';
import { useCalendar } from '@/hooks/useOperations';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { BOOKING_STATUS_TONE, WEEKDAYS } from '@/constants/ui';
import { cn, toYmd } from '@/lib/utils';
import type { Booking } from '@/types';
import { EmptyState, ErrorState, PageHeader, SectionCard, StatusBadge } from '@/components/common';
import { Button, Card } from '@/components/ui/primitives';

const DOT: Record<string, string> = { blue: 'bg-brand-blue', green: 'bg-brand-green-500', amber: 'bg-amber-500', red: 'bg-red-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500', neutral: 'bg-slate-400' };

export default function CalendarPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { branchId } = useBranchScope();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const gridStart = startOfWeek(month);
  const gridEnd = endOfWeek(endOfMonth(month));
  const { data, isLoading, error, refetch } = useCalendar({ from: toYmd(gridStart), to: toYmd(gridEnd), branchId });

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    (data ?? []).forEach((b) => {
      const k = b.scheduledDate.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), b]);
    });
    return m;
  }, [data]);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dayBookings = byDay.get(toYmd(selected)) ?? [];

  return (
    <>
      <PageHeader
        title="Service Calendar"
        description="Scheduled bookings by day. Click a day to see its agenda."
        breadcrumbs={[{ label: 'Bookings', to: ROUTES.BOOKINGS }, { label: 'Service Calendar' }]}
        actions={can('bookings.create') && <Button onClick={() => navigate(ROUTES.BOOKING_NEW)}><CalendarPlus /> New booking</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="font-display text-lg font-bold">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>Today</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
            </div>
          </div>
          {error ? (
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          ) : (
            <div className={cn('grid grid-cols-7 transition-opacity', isLoading && 'opacity-60')}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="border-b bg-slate-50 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">{d}</div>
              ))}
              {days.map((day) => {
                const list = byDay.get(toYmd(day)) ?? [];
                const sel = isSameDay(day, selected);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn(
                      'min-h-[92px] border-b border-r p-1.5 text-left align-top transition-colors duration-micro sm:min-h-[108px] sm:p-2 [&:nth-child(7n)]:border-r-0',
                      !isSameMonth(day, month) && 'bg-slate-50/60 text-slate-400',
                      sel ? 'bg-brand-blue-50/70 ring-2 ring-inset ring-brand-blue/30' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className={cn('num inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', isToday(day) && 'bg-brand-blue text-white')}>{format(day, 'd')}</span>
                    <div className="mt-1 space-y-1">
                      {list.slice(0, 3).map((b) => (
                        <div key={b.id} className="flex items-center gap-1 truncate rounded bg-white px-1 py-0.5 text-[10.5px] font-medium text-slate-700 shadow-sm ring-1 ring-border">
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[BOOKING_STATUS_TONE[b.status] ?? 'neutral'])} />
                          <span className="truncate">{b.scheduledTime?.slice(0, 5) ?? ''} {b.customer.fullName}</span>
                        </div>
                      ))}
                      {list.length > 3 && <p className="px-1 text-[10.5px] font-semibold text-brand-blue">+{list.length - 3} more</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        <SectionCard title={format(selected, 'EEEE, dd MMM')} description={`${dayBookings.length} booking(s)`} bodyClassName="p-0" className="xl:sticky xl:top-[97px] xl:self-start">
          {!dayBookings.length ? (
            <EmptyState title="No bookings" description="Nothing scheduled for this day." className="py-10" />
          ) : (
            <ul className="divide-y">
              {dayBookings
                .slice()
                .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
                .map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => navigate(ROUTES.BOOKING_DETAIL(b.id))} className="flex w-full gap-3 px-5 py-3 text-left hover:bg-slate-50">
                      <span className="num w-16 shrink-0 text-xs font-bold text-brand-blue">{b.scheduledTime ?? 'Any time'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-brand-navy">{b.customer.fullName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{b.items.map((i) => i.serviceName).join(', ') || b.problemDescription}</span>
                        <span className="mt-1 block text-xs text-slate-500">{b.assignments[0]?.staff.user.name ?? 'Unassigned'}</span>
                      </span>
                      <StatusBadge status={b.status} />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
