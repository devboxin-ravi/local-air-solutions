/**
 * Assignments list in three modes: all, live job tracking, completed jobs.
 */

import { useNavigate } from 'react-router-dom';
import { useListState } from '@/hooks/useListState';
import { useAssignmentList, useBookingList } from '@/hooks/useOperations';
import { useTechnicians } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import { formatDate, formatDateTime, formatRelative, humanize } from '@/lib/utils';
import type { Assignment, Booking } from '@/types';
import { PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';

type Mode = 'all' | 'tracking' | 'completed';

const TITLES: Record<Mode, { title: string; description: string }> = {
  all: { title: 'All Assignments', description: 'Every technician assignment, including reassignments and rejections.' },
  tracking: { title: 'Job Tracking', description: 'Live jobs in the field — assigned, accepted, on the way, arrived and in progress.' },
  completed: { title: 'Completed Jobs', description: 'Jobs completed by technicians.' },
};

const TRACK_STEPS = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

const Progress = ({ status }: { status: string }) => {
  const idx = TRACK_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label={`Progress: ${humanize(status)}`}>
      {TRACK_STEPS.map((s, i) => (
        <span key={s} title={humanize(s)} className={`h-1.5 w-6 rounded-full ${i <= idx ? (status === 'COMPLETED' ? 'bg-brand-green-500' : 'bg-brand-blue') : 'bg-slate-200'}`} />
      ))}
    </div>
  );
};

export default function AssignmentsPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const list = useListState();
  // Technicians of the branch selected in the header (all branches when none is selected).
  const { data: techs } = useTechnicians(list.query.branchId as number | undefined);
  const isBookingMode = mode !== 'all';
  const bookingStatus = mode === 'tracking' ? 'ASSIGNED,ACCEPTED,ON_THE_WAY,ARRIVED,IN_PROGRESS' : 'COMPLETED';
  const bookings = useBookingList({ ...list.query, status: bookingStatus, dateField: 'scheduledDate', sortBy: mode === 'tracking' ? 'scheduledDate' : 'createdAt', sortOrder: mode === 'tracking' ? 'asc' : 'desc' }, isBookingMode);
  const assignments = useAssignmentList(list.query, !isBookingMode);

  const bookingCols: Column<Booking>[] = [
    { key: 'bookingNumber', header: 'Booking', cell: (b) => <span className="font-semibold text-brand-blue">{b.bookingNumber}</span> },
    { key: 'customer', header: 'Customer', cell: (b) => <div><p className="font-medium">{b.customer.fullName}</p><p className="text-xs text-muted-foreground">{b.addressSnapshot.city} · {b.addressSnapshot.pincode}</p></div> },
    { key: 'tech', header: 'Technician', cell: (b) => b.assignments[0]?.staff.user.name ?? '—' },
    { key: 'when', header: 'Scheduled', cell: (b) => `${formatDate(b.scheduledDate)} ${b.scheduledTime ?? ''}` },
    { key: 'progress', header: 'Progress', cell: (b) => <Progress status={b.status} /> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    ...(mode === 'completed' ? [{ key: 'completedAt', header: 'Completed', cell: (b: Booking) => formatDateTime(b.completedAt) }] : []),
  ];

  const assignmentCols: Column<Assignment>[] = [
    { key: 'booking', header: 'Booking', cell: (a) => <span className="font-semibold text-brand-blue">{a.booking.bookingNumber}</span> },
    { key: 'tech', header: 'Technician', cell: (a) => <div><p className="font-medium">{a.staff.user.name}</p><p className="text-xs text-muted-foreground">{a.staff.staffCode}</p></div> },
    { key: 'customer', header: 'Customer', cell: (a) => a.booking.customer.fullName },
    { key: 'scheduled', header: 'Scheduled', cell: (a) => formatDate(a.booking.scheduledDate) },
    { key: 'assignedAt', header: 'Assigned', cell: (a) => formatRelative(a.assignedAt) },
    { key: 'status', header: 'Assignment', cell: (a) => <div className="space-y-1"><StatusBadge status={a.status} />{!a.isCurrent && <p className="text-[11px] text-muted-foreground">Superseded</p>}{a.rejectReason && <p className="max-w-[200px] truncate text-[11px] text-red-600">{a.rejectReason}</p>}</div> },
    { key: 'bstatus', header: 'Booking status', cell: (a) => <StatusBadge status={a.booking.status} /> },
  ];

  const toolbar = (
    <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
      <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Booking no. or customer…" />
      <SelectFilter searchable placeholder="All technicians" value={list.state.filters.staffId} onChange={(v) => list.setFilter('staffId', v)} options={(techs ?? []).map((t) => ({ value: t.id, label: t.user.name }))} />
      {!isBookingMode && <SelectFilter placeholder="All statuses" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'].map((s) => ({ value: s, label: humanize(s) }))} />}
    </FilterBar>
  );

  return (
    <>
      <PageHeader title={TITLES[mode].title} description={TITLES[mode].description} breadcrumbs={[{ label: 'Assignments', to: ROUTES.ASSIGNMENTS }, { label: TITLES[mode].title }]} />
      {isBookingMode ? (
        <DataTable columns={bookingCols} rows={bookings.data?.items} rowKey={(b) => b.id} loading={bookings.isLoading} error={bookings.error ? (bookings.error as Error).message : null} onRetry={bookings.refetch} meta={bookings.data?.meta} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} onRowClick={(b) => navigate(ROUTES.BOOKING_DETAIL(b.id))} toolbar={toolbar} emptyTitle={mode === 'tracking' ? 'No jobs in the field right now' : 'No completed jobs'} />
      ) : (
        <DataTable columns={assignmentCols} rows={assignments.data?.items} rowKey={(a) => a.id} loading={assignments.isLoading} error={assignments.error ? (assignments.error as Error).message : null} onRetry={assignments.refetch} meta={assignments.data?.meta} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} onRowClick={(a) => navigate(ROUTES.BOOKING_DETAIL(a.booking.id))} toolbar={toolbar} />
      )}
    </>
  );
}
