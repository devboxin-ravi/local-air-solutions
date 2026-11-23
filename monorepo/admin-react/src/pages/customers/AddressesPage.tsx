/**
 * All customer addresses with coordinate status and map links.
 */

import { useNavigate } from 'react-router-dom';
import { Navigation } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useAllAddresses } from '@/hooks/usePeople';
import { ROUTES } from '@/constants/routes';
import { mapsDirectionsUrl } from '@/lib/utils';
import type { Address } from '@/types';
import { Badge, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput } from '@/components/Filters';
import { Button, Input } from '@/components/ui/primitives';

export default function AddressesPage() {
  const navigate = useNavigate();
  const list = useListState();
  const { data, isLoading, error, refetch } = useAllAddresses(list.query);

  const columns: Column<Address>[] = [
    { key: 'customer', header: 'Customer', cell: (a) => <div><p className="font-semibold text-brand-navy">{a.customer?.fullName}</p><p className="text-xs text-muted-foreground">{a.customer?.customerCode} · {a.customer?.mobile}</p></div> },
    { key: 'label', header: 'Label', cell: (a) => <div className="flex gap-1"><Badge>{a.label}</Badge>{a.isDefault && <Badge tone="green">Default</Badge>}</div> },
    { key: 'address', header: 'Address', cell: (a) => <span className="line-clamp-2 max-w-[340px]">{[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}</span> },
    { key: 'city', header: 'City / PIN', cell: (a) => <div><p>{a.city?.name}</p><p className="text-xs text-muted-foreground">{a.pincode}</p></div> },
    { key: 'area', header: 'Service area', cell: (a) => a.serviceArea?.name ?? <span className="text-amber-600">Not covered</span> },
    { key: 'geo', header: 'Coordinates', cell: (a) => (a.latitude ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Missing</Badge>) },
    { key: 'map', header: '', align: 'right', cell: (a) => <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}><a href={mapsDirectionsUrl(a.latitude, a.longitude, `${a.line1} ${a.city?.name ?? ''} ${a.pincode}`)} target="_blank" rel="noreferrer"><Navigation /> Map</a></Button> },
  ];

  return (
    <>
      <PageHeader title="Customer Addresses" description="Service locations across all customers." breadcrumbs={[{ label: 'Customers', to: ROUTES.CUSTOMERS }, { label: 'Addresses' }]} />
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
        onRowClick={(a) => a.customer && navigate(ROUTES.CUSTOMER_DETAIL(a.customer.id))}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Address, landmark or customer…" />
            <Input placeholder="PIN code" inputMode="numeric" maxLength={6} className="sm:w-32" defaultValue={list.state.filters.pincode} onChange={(e) => list.setFilter('pincode', e.target.value || undefined)} aria-label="PIN code filter" />
          </FilterBar>
        }
      />
    </>
  );
}
