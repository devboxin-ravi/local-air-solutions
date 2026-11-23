/**
 * Assign Technician queue: confirmed bookings without a technician, with smart suggestions.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, HardHat } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useAssignAction, useBookingList, useSuggestions } from '@/hooks/useOperations';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/lib/utils';
import type { Booking } from '@/types';
import { PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { AssignDialog } from '@/components/BookingWidgets';
import { FilterBar, SearchInput } from '@/components/Filters';
import { Button } from '@/components/ui/primitives';

export default function AssignPage() {
  const navigate = useNavigate();
  const list = useListState({ sortBy: 'scheduledDate', sortOrder: 'asc' });
  const { data, isLoading, error, refetch } = useBookingList({ ...list.query, status: 'CONFIRMED,RESCHEDULED', unassigned: true });
  const [target, setTarget] = useState<Booking | null>(null);
  const suggestions = useSuggestions(target?.id);
  const assign = useAssignAction();

  const columns: Column<Booking>[] = [
    { key: 'bookingNumber', header: 'Booking', cell: (b) => <span className="font-semibold text-brand-blue">{b.bookingNumber}</span> },
    { key: 'customer', header: 'Customer', cell: (b) => <div><p className="font-medium">{b.customer.fullName}</p><p className="text-xs text-muted-foreground">{b.addressSnapshot.line1}, {b.addressSnapshot.city}</p></div> },
    { key: 'service', header: 'Service', cell: (b) => <span className="line-clamp-1 max-w-[220px]">{b.items.map((i) => i.serviceName).join(', ') || b.problemDescription}</span> },
    { key: 'scheduledDate', header: 'Scheduled', sortable: true, cell: (b) => <div><p className="font-medium">{formatDate(b.scheduledDate)}</p><p className="text-xs text-muted-foreground">{b.scheduledTime ?? 'Any time'}</p></div> },
    { key: 'branch', header: 'Branch', cell: (b) => b.branch.name },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    { key: 'action', header: '', align: 'right', cell: (b) => <Button size="sm" onClick={(e) => { e.stopPropagation(); setTarget(b); }}><HardHat /> Assign</Button> },
  ];

  return (
    <>
      <PageHeader title="Assign Technician" description="Confirmed bookings waiting for a technician, earliest first." breadcrumbs={[{ label: 'Assignments', to: ROUTES.ASSIGNMENTS }, { label: 'Assign Technician' }]} />
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
        emptyTitle="All caught up"
        emptyDescription="Every confirmed booking has a technician."
        emptyAction={<CheckCircle2 className="h-6 w-6 text-brand-green-500" />}
        toolbar={<FilterBar><SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Booking no. or customer…" /></FilterBar>}
      />
      <AssignDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        suggestions={suggestions.data}
        loading={suggestions.isLoading}
        submitting={assign.isPending}
        bookingLabel={target?.bookingNumber}
        onAssign={(staffId, notes) => target && assign.mutate({ bookingId: target.id, staffId, notes: notes || undefined }, { onSuccess: () => setTarget(null) })}
      />
    </>
  );
}
