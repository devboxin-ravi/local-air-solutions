/**
 * Customer directory with search (name, mobile, ID, address) and filters.
 */

import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useCustomerList } from '@/hooks/usePeople';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { formatDate, humanize, initials } from '@/lib/utils';
import type { Customer } from '@/types';
import { Badge, PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Avatar, Button } from '@/components/ui/primitives';

export default function CustomersListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ sortBy: 'createdAt' });
  const { data, isLoading, error, refetch } = useCustomerList(list.query);

  const columns: Column<Customer>[] = [
    {
      key: 'fullName',
      header: 'Customer',
      sortable: true,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar fallback={initials(c.fullName)} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-brand-navy">{c.fullName}</p>
            <p className="text-xs text-muted-foreground">{c.customerCode}</p>
          </div>
        </div>
      ),
    },
    { key: 'mobile', header: 'Contact', cell: (c) => <div><p>{c.countryCode} {c.mobile}</p><p className="truncate text-xs text-muted-foreground">{c.email ?? '—'}</p></div> },
    { key: 'location', header: 'Location', cell: (c) => { const a = c.addresses[0]; return a ? <div><p>{a.city?.name}</p><p className="text-xs text-muted-foreground">{a.pincode}</p></div> : <span className="text-muted-foreground">No address</span>; } },
    { key: 'branch', header: 'Branch', cell: (c) => c.branch?.name ?? '—' },
    { key: 'type', header: 'Type', cell: (c) => <Badge tone={c.customerType === 'BUSINESS' ? 'violet' : 'neutral'}>{humanize(c.customerType)}</Badge> },
    { key: 'counts', header: 'Bookings / AMC', cell: (c) => <span className="num">{c._count?.bookings ?? 0} / {c._count?.amcContracts ?? 0}</span> },
    { key: 'createdAt', header: 'Since', sortable: true, cell: (c) => formatDate(c.createdAt) },
    { key: 'status', header: 'Status', cell: (c) => <div className="flex flex-col items-start gap-1"><StatusBadge status={c.status} />{c.user && <Badge tone="cyan">App user</Badge>}</div> },
  ];

  return (
    <>
      <PageHeader title="All Customers" description="Customer profiles, addresses and history." breadcrumbs={[{ label: 'Customers', to: ROUTES.CUSTOMERS }, { label: 'All Customers' }]} actions={can('customers.create') && <Button onClick={() => navigate(ROUTES.CUSTOMER_NEW)}><UserPlus /> Add customer</Button>} />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(c) => c.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.state.sortBy}
        sortOrder={list.state.sortOrder}
        onSort={list.toggleSort}
        onRowClick={(c) => navigate(ROUTES.CUSTOMER_DETAIL(c.id))}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Name, mobile, ID, address, PIN…" className="sm:w-80" />
            <SelectFilter placeholder="All types" value={list.state.filters.customerType} onChange={(v) => list.setFilter('customerType', v)} options={[{ value: 'INDIVIDUAL', label: 'Individual' }, { value: 'BUSINESS', label: 'Business' }]} className="sm:w-36" />
            <SelectFilter placeholder="Any status" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => ({ value: s, label: humanize(s) }))} className="sm:w-36" />
          </FilterBar>
        }
      />
    </>
  );
}
