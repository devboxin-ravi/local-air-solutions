/**
 * Bookings list (all / status views / repairs / customer service history). Composition only.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Wrench } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useBookingList } from '@/hooks/useOperations';
import { useAuth } from '@/hooks/useAuth';
import { useServiceLookup } from '@/hooks/useApi';
import { BOOKING_VIEWS, ROUTES } from '@/constants/routes';
import { BOOKING_STATUSES } from '@/constants/ui';
import { formatDate, formatMoney, humanize } from '@/lib/utils';
import type { Booking } from '@/types';
import { Badge, PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button } from '@/components/ui/primitives';

type Preset = 'repairs' | 'history';

const PRESETS: Record<Preset, { title: string; description: string; filters: Record<string, string> }> = {
  repairs: { title: 'Repairing Management', description: 'All repair requests with problem details and status.', filters: { bookingType: 'REPAIR' } },
  history: { title: 'Customer Service History', description: 'Completed services across all customers.', filters: { status: 'COMPLETED' } },
};

export default function BookingsListPage({ preset }: { preset?: Preset }) {
  const { view } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const viewDef = view ? BOOKING_VIEWS[view] : undefined;
  const presetDef = preset ? PRESETS[preset] : undefined;
  const lockedFilters = { ...(presetDef?.filters ?? {}), ...(viewDef?.status ? { status: viewDef.status } : {}) };

  const list = useListState({ sortBy: 'createdAt' });
  const { data, isLoading, isFetching, error, refetch } = useBookingList({ ...lockedFilters, ...list.query });
  const { data: services } = useServiceLookup();

  const title = presetDef?.title ?? viewDef?.title ?? 'All Bookings';
  const description = presetDef?.description ?? viewDef?.description ?? 'Every service and repair booking across branches.';

  const columns: Column<Booking>[] = [
    {
      key: 'bookingNumber',
      header: 'Booking',
      sortable: true,
      cell: (b) => (
        <div>
          <p className="font-semibold text-brand-blue">{b.bookingNumber}</p>
          <p className="text-xs text-muted-foreground">{b.bookingType === 'REPAIR' ? 'Repair' : 'Service'} · {b.branch.name}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-brand-navy">{b.customer.fullName}</p>
          <p className="text-xs text-muted-foreground">{b.customer.mobile}</p>
        </div>
      ),
    },
    {
      key: 'service',
      header: preset === 'repairs' ? 'Problem' : 'Service',
      cell: (b) => (
        <p className="max-w-[240px] truncate text-slate-700" title={b.problemDescription ?? undefined}>
          {preset === 'repairs' ? b.problemDescription ?? '—' : b.items.map((i) => i.serviceName).join(', ') || b.problemDescription || '—'}
        </p>
      ),
    },
    {
      key: 'scheduledDate',
      header: 'Schedule',
      sortable: true,
      cell: (b) => (
        <div>
          <p className="font-medium">{formatDate(b.scheduledDate)}</p>
          <p className="text-xs text-muted-foreground">{b.scheduledTime ?? 'Any time'}</p>
        </div>
      ),
    },
    { key: 'technician', header: 'Technician', cell: (b) => b.assignments[0]?.staff.user.name ?? <span className="text-muted-foreground">Unassigned</span> },
    { key: 'estimatedTotal', header: 'Amount', sortable: true, align: 'right', cell: (b) => <span className="num font-semibold">{formatMoney(b.estimatedTotal)}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (b) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={b.status} />
          {b.paymentStatus !== 'UNPAID' && <Badge tone={b.paymentStatus === 'PAID' ? 'green' : 'amber'}>{humanize(b.paymentStatus)}</Badge>}
        </div>
      ),
    },
  ];

  const statusOptions = (viewDef?.status ? viewDef.status.split(',') : BOOKING_STATUSES).map((s) => ({ value: s, label: humanize(s) }));

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: 'Bookings', to: ROUTES.BOOKINGS }, { label: title }]}
        actions={
          can('bookings.create') && (
            <Button onClick={() => navigate(ROUTES.BOOKING_NEW)}>
              {preset === 'repairs' ? <Wrench /> : <CalendarPlus />} New booking
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(b) => b.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.state.sortBy}
        sortOrder={list.state.sortOrder}
        onSort={list.toggleSort}
        onRowClick={(b) => navigate(ROUTES.BOOKING_DETAIL(b.id))}
        className={isFetching && !isLoading ? 'opacity-80 transition-opacity' : undefined}
        emptyTitle="No bookings match"
        emptyAction={can('bookings.create') ? <Button variant="soft" onClick={() => navigate(ROUTES.BOOKING_NEW)}><CalendarPlus /> Create booking</Button> : undefined}
        toolbar={
          <FilterBar
            right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to, dateField: 'scheduledDate' })} />}
          >
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Booking no., customer, mobile…" />
            {preset !== 'history' && <SelectFilter placeholder="All statuses" value={list.state.filters.statusFilter} onChange={(v) => list.update({ statusFilter: v, status: v || undefined })} options={statusOptions} />}
            {preset !== 'repairs' && (
              <SelectFilter placeholder="All types" value={list.state.filters.bookingType} onChange={(v) => list.setFilter('bookingType', v)} options={[{ value: 'SERVICE', label: 'Service' }, { value: 'REPAIR', label: 'Repair' }]} className="sm:w-36" />
            )}
            <SelectFilter placeholder="All services" value={list.state.filters.serviceId} onChange={(v) => list.setFilter('serviceId', v)} options={(services ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          </FilterBar>
        }
      />
    </>
  );
}
