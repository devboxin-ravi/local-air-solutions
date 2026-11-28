/**
 * Service reminders dashboard: upcoming, due today, overdue, completed.
 */

import { useNavigate } from 'react-router-dom';
import { BellRing, CalendarCheck2, CalendarClock, CheckCircle2, MessageCircle, AlarmClockOff } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useReminderActions, useReminderList, useReminderSummary } from '@/hooks/useEngagement';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { cn, formatDate, formatRelative } from '@/lib/utils';
import type { Reminder } from '@/types';
import { Badge, PageHeader, StatCard, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button } from '@/components/ui/primitives';

const BUCKETS = [
  { key: 'upcoming', label: 'Upcoming', icon: CalendarClock, tone: 'blue' as const },
  { key: 'dueToday', label: 'Due Today', icon: BellRing, tone: 'amber' as const },
  { key: 'overdue', label: 'Overdue', icon: AlarmClockOff, tone: 'red' as const },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'green' as const },
];

export default function RemindersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { branchId } = useBranchScope();
  const list = useListState({ filters: { bucket: 'upcoming' } });
  const bucket = list.state.filters.bucket ?? 'upcoming';
  const { data, isLoading, error, refetch } = useReminderList(list.query);
  const summary = useReminderSummary({ branchId });
  const actions = useReminderActions();

  const columns: Column<Reminder>[] = [
    { key: 'customer', header: 'Customer', cell: (r) => <div><p className="font-semibold text-brand-navy">{r.customer.fullName}</p><p className="text-xs text-muted-foreground">{r.customer.mobile}</p></div> },
    { key: 'service', header: 'Service', cell: (r) => <div><p>{r.service?.name ?? 'General service'}</p>{r.booking && <p className="text-xs text-muted-foreground">from {r.booking.bookingNumber}</p>}{r.note && <p className="max-w-[260px] truncate text-xs text-amber-700" title={r.note}>{r.note}</p>}</div> },
    { key: 'type', header: 'Type', cell: (r) => <Badge tone={r.type === 'AMC' ? 'violet' : 'blue'}>{r.type}</Badge> },
    { key: 'due', header: 'Due date', cell: (r) => <div><p className="font-medium">{formatDate(r.dueDate)}</p><p className="text-xs text-muted-foreground">{formatRelative(r.dueDate)}</p></div> },
    { key: 'notified', header: 'Notified', cell: (r) => (r.notifyCount ? `${r.notifyCount}× · ${formatRelative(r.lastNotifiedAt)}` : 'Not yet') },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => actions.whatsapp.mutate(r.id)} aria-label="Share on WhatsApp"><MessageCircle className="text-green-600" /></Button>
          {can('bookings.create') && !['COMPLETED', 'DISMISSED'].includes(r.status) && <Button size="sm" variant="soft" onClick={() => navigate(`${ROUTES.BOOKING_NEW}?customerId=${r.customer.id}`)}><CalendarCheck2 /> Book</Button>}
          {can('reminders.edit') && !['COMPLETED', 'DISMISSED'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => actions.update.mutate({ id: r.id, body: { status: 'DISMISSED' } })}>Dismiss</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Service Reminders" description="Created automatically after reminder-eligible services (default every 6 months). Customers are notified before the due date." breadcrumbs={[{ label: 'Customers', to: ROUTES.CUSTOMERS }, { label: 'Service Reminders' }]} />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {BUCKETS.map((b) => (
          <button key={b.key} type="button" onClick={() => list.setFilter('bucket', b.key)} className={cn('rounded-xl text-left transition-shadow', bucket === b.key && 'ring-2 ring-brand-blue ring-offset-2')}>
            <StatCard label={b.label} value={summary.data?.[b.key as keyof typeof summary.data] ?? '—'} icon={b.icon} tone={b.tone} loading={summary.isLoading} />
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(r) => navigate(ROUTES.CUSTOMER_DETAIL(r.customer.id))}
        emptyTitle="No reminders in this bucket"
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Customer name or mobile…" />
            <SelectFilter placeholder="All types" value={list.state.filters.type} onChange={(v) => list.setFilter('type', v)} options={[{ value: 'SERVICE', label: 'Service' }, { value: 'AMC', label: 'AMC' }]} className="sm:w-36" />
          </FilterBar>
        }
      />
    </>
  );
}
