/**
 * All AMC visits across contracts.
 */

import { useNavigate } from 'react-router-dom';
import { useListState } from '@/hooks/useListState';
import { useAmcVisits } from '@/hooks/useFinance';
import { ROUTES } from '@/constants/routes';
import { formatDate, humanize } from '@/lib/utils';
import type { AmcVisit } from '@/types';
import { PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';

export default function AmcVisitsPage() {
  const navigate = useNavigate();
  const list = useListState();
  const { data, isLoading, error, refetch } = useAmcVisits(list.query);

  const columns: Column<AmcVisit>[] = [
    { key: 'amc', header: 'AMC', cell: (v) => <span className="font-semibold text-brand-blue">{v.amcContract?.amcNumber}</span> },
    { key: 'customer', header: 'Customer', cell: (v) => <div><p className="font-medium">{v.amcContract?.customer.fullName}</p><p className="text-xs text-muted-foreground">{v.amcContract?.customer.mobile}</p></div> },
    { key: 'visit', header: 'Visit', cell: (v) => `#${v.visitNumber}` },
    { key: 'date', header: 'Scheduled', cell: (v) => formatDate(v.scheduledDate) },
    { key: 'booking', header: 'Booking', cell: (v) => (v.booking ? <span>{v.booking.bookingNumber} <StatusBadge status={v.booking.status} /></span> : <span className="text-muted-foreground">Not booked</span>) },
    { key: 'status', header: 'Visit status', cell: (v) => <StatusBadge status={v.status} /> },
  ];

  return (
    <>
      <PageHeader title="AMC Visits" description="Planned maintenance visits. Open a contract to book a visit." breadcrumbs={[{ label: 'AMC', to: ROUTES.AMC }, { label: 'Visits' }]} />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(v) => v.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(v) => navigate(v.booking ? ROUTES.BOOKING_DETAIL(v.booking.id) : ROUTES.AMC_DETAIL(v.amcContractId))}
        toolbar={
          <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="AMC no. or customer…" />
            <SelectFilter placeholder="All statuses" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['SCHEDULED', 'BOOKED', 'COMPLETED', 'MISSED', 'CANCELLED'].map((s) => ({ value: s, label: humanize(s) }))} />
          </FilterBar>
        }
      />
    </>
  );
}
