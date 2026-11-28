/**
 * Dynamic service catalogue list with activation toggles.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useServiceActions, useServiceList } from '@/hooks/useCatalog';
import { useCategories } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { PRICING_TYPES, ROW_ACTIONS } from '@/constants/ui';
import { assetUrl, priceLabel } from '@/lib/utils';
import type { Service } from '@/types';
import { Badge, ConfirmDialog, PageHeader } from '@/components/common';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button, Switch } from '@/components/ui/primitives';

export default function ServicesListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ sortBy: 'sortOrder', sortOrder: 'asc' });
  const { data, isLoading, error, refetch } = useServiceList({ ...list.query, branchId: undefined });
  const { data: categories } = useCategories();
  const actions = useServiceActions();
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue-50 to-brand-green-50 text-xs font-bold text-brand-blue ring-1 ring-brand-blue-100">
            {s.imageUrl ? <img src={assetUrl(s.imageUrl)} alt="" className="h-full w-full rounded-xl object-cover" /> : s.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold text-brand-navy">
              {s.name} {s.isPopular && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            </p>
            <p className="text-xs text-muted-foreground">{s.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (s) => <Badge tone="blue">{s.category.name}</Badge> },
    { key: 'basePrice', header: 'Service Price', sortable: true, cell: (s) => <span className="num font-semibold">{priceLabel(s)}</span> },
    { key: 'durationMinutes', header: 'Duration', sortable: true, cell: (s) => `${s.durationMinutes} min` },
    { key: 'gst', header: 'GST', cell: (s) => (s.gstApplicable ? `${s.gstRate}%` : 'Exempt') },
    { key: 'reminder', header: 'Reminder', cell: (s) => (s.reminderEligible ? <Badge tone="green">{s.reminderIntervalMonths ?? 'Default'} {s.reminderIntervalMonths ? 'mo' : ''}</Badge> : <span className="text-muted-foreground">—</span>) },
    {
      key: 'isActive',
      header: 'Active',
      cell: (s) => <Switch checked={s.isActive} disabled={!can('services.edit')} onCheckedChange={(v) => actions.setActive.mutate({ id: s.id, isActive: v })} onClick={(e) => e.stopPropagation()} aria-label={`Toggle ${s.name}`} />,
    },
    {
      key: 'actions',
      header: ROW_ACTIONS.HEADER,
      align: 'right',
      cell: (s) => (
        <RowActions
          onEdit={can('services.edit') ? () => navigate(ROUTES.SERVICE_EDIT(s.id)) : undefined}
          onDelete={can('services.delete') && s.isActive ? () => setToDelete(s) : undefined}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="All Services"
        description={`${data?.meta.total ?? '…'} services in the catalogue. Customers see only active services.`}
        breadcrumbs={[{ label: 'Services', to: ROUTES.SERVICES }, { label: 'All Services' }]}
        actions={can('services.create') && <Button onClick={() => navigate(ROUTES.SERVICE_NEW)}><Plus /> Add service</Button>}
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(s) => s.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.state.sortBy}
        sortOrder={list.state.sortOrder}
        onSort={list.toggleSort}
        onRowClick={can('services.edit') ? (s) => navigate(ROUTES.SERVICE_EDIT(s.id)) : undefined}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Name, code or description…" />
            <SelectFilter searchable placeholder="All categories" value={list.state.filters.categoryId} onChange={(v) => list.setFilter('categoryId', v)} options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <SelectFilter placeholder="All pricing" value={list.state.filters.pricingType} onChange={(v) => list.setFilter('pricingType', v)} options={PRICING_TYPES.map((p) => ({ value: p.value, label: p.label }))} />
            <SelectFilter placeholder="Any status" value={list.state.filters.isActive} onChange={(v) => list.setFilter('isActive', v)} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} className="sm:w-36" />
          </FilterBar>
        }
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description={ROW_ACTIONS.DEACTIVATE_NOTE}
        confirmLabel="Delete"
        destructive
        loading={actions.remove.isPending}
        onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </>
  );
}
