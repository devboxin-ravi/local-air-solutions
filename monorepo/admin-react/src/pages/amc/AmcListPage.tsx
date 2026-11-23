/**
 * AMC contracts list (all / expiring within 30 days).
 */

import { useNavigate } from 'react-router-dom';
import { ShieldPlus } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useAmcList } from '@/hooks/useFinance';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { formatDate, formatMoney, formatRelative, humanize } from '@/lib/utils';
import type { AmcContract } from '@/types';
import { PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button } from '@/components/ui/primitives';

const EXPIRING_DAYS = 30;

export default function AmcListPage({ expiring }: { expiring?: boolean }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState();
  const { data, isLoading, error, refetch } = useAmcList({ ...list.query, ...(expiring ? { expiringWithinDays: EXPIRING_DAYS } : {}) });

  const columns: Column<AmcContract>[] = [
    { key: 'amcNumber', header: 'AMC', cell: (a) => <div><p className="font-semibold text-brand-blue">{a.amcNumber}</p><p className="text-xs text-muted-foreground">{a.branch.name}</p></div> },
    { key: 'customer', header: 'Customer', cell: (a) => <div><p className="font-medium text-brand-navy">{a.customer.fullName}</p><p className="text-xs text-muted-foreground">{a.customer.mobile}</p></div> },
    { key: 'product', header: 'Products', cell: (a) => <span className="line-clamp-1 max-w-[220px]">{a.productDetails}</span> },
    { key: 'period', header: 'Period', cell: (a) => <div><p>{formatDate(a.startDate)} → {formatDate(a.endDate)}</p>{expiring && <p className="text-xs font-semibold text-amber-600">Expires {formatRelative(a.endDate)}</p>}</div> },
    {
      key: 'visits',
      header: 'Visits',
      cell: (a) => {
        const done = a.completedVisits ?? 0;
        return (
          <div className="w-28">
            <p className="num text-xs font-semibold">{done}/{a.totalVisits} done</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-green-500" style={{ width: `${(done / a.totalVisits) * 100}%` }} /></div>
          </div>
        );
      },
    },
    { key: 'amount', header: 'Value', align: 'right', cell: (a) => <span className="num font-semibold">{formatMoney(a.contractAmount)}</span> },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={expiring ? 'Expiring AMC' : 'All AMC Contracts'}
        description={expiring ? `Active contracts ending in the next ${EXPIRING_DAYS} days — reach out for renewal.` : 'Annual Maintenance Contracts with visit progress.'}
        breadcrumbs={[{ label: 'AMC', to: ROUTES.AMC }, { label: expiring ? 'Expiring' : 'All Contracts' }]}
        actions={can('amc.create') && <Button onClick={() => navigate(ROUTES.AMC_NEW)}><ShieldPlus /> Create AMC</Button>}
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(a) => a.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={(a) => navigate(ROUTES.AMC_DETAIL(a.id))}
        emptyTitle={expiring ? 'No contracts expiring soon' : 'No AMC contracts yet'}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="AMC no., customer, mobile…" />
            {!expiring && <SelectFilter placeholder="All statuses" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED'].map((s) => ({ value: s, label: humanize(s) }))} />}
          </FilterBar>
        }
      />
    </>
  );
}
