/**
 * Accounts → For Invoice: bills of completed jobs waiting to be checked, edited and approved into invoices.
 */

import { useNavigate } from 'react-router-dom';
import { useListState } from '@/hooks/useListState';
import { useDraftInvoiceList } from '@/hooks/useFinance';
import { ROUTES } from '@/constants/routes';
import { FOR_INVOICE, GST_FILTER_OPTIONS, ROW_ACTIONS } from '@/constants/ui';
import { formatDate, formatMoney, toNumber } from '@/lib/utils';
import type { Invoice } from '@/types';
import { Badge, PageHeader } from '@/components/common';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';

export default function ForInvoicePage() {
  const navigate = useNavigate();
  const list = useListState();
  const { data, isLoading, error, refetch } = useDraftInvoiceList(list.query);
  const open = (i: Invoice) => navigate(ROUTES.FOR_INVOICE_DETAIL(i.id));

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Bill', cell: (i) => <div><p className="font-semibold text-brand-blue">{i.booking?.bookingNumber ?? i.invoiceNumber}</p><p className="text-xs text-muted-foreground">{i.invoiceNumber}</p></div> },
    { key: 'date', header: 'Job completed', cell: (i) => formatDate(i.invoiceDate) },
    { key: 'customer', header: 'Customer', cell: (i) => <div><p className="font-medium">{i.customer.fullName}</p><p className="text-xs text-muted-foreground">{i.customer.mobile}</p></div> },
    { key: 'gst', header: 'GST', align: 'right', cell: (i) => (toNumber(i.gstTotal) > 0 ? <span className="num">{formatMoney(i.gstTotal)}</span> : <Badge tone="neutral">Non-GST</Badge>) },
    { key: 'total', header: 'Total', align: 'right', cell: (i) => <span className="num font-semibold">{formatMoney(i.grandTotal)}</span> },
    { key: 'status', header: 'Status', cell: () => <Badge tone="amber">{FOR_INVOICE.PENDING}</Badge> },
    { key: 'actions', header: ROW_ACTIONS.HEADER, align: 'right', cell: (i) => <RowActions onView={() => open(i)} /> },
  ];

  return (
    <>
      <PageHeader title={FOR_INVOICE.TITLE} description={FOR_INVOICE.DESCRIPTION} breadcrumbs={[{ label: 'Accounts', to: ROUTES.INVOICES }, { label: FOR_INVOICE.TITLE }]} />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(i) => i.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={open}
        emptyTitle={FOR_INVOICE.EMPTY_TITLE}
        emptyDescription={FOR_INVOICE.EMPTY_DESCRIPTION}
        toolbar={
          <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Booking no., customer, mobile…" />
            <SelectFilter placeholder="GST & non-GST" value={list.state.filters.gst} onChange={(v) => list.setFilter('gst', v)} options={GST_FILTER_OPTIONS} className="sm:w-44" />
          </FilterBar>
        }
      />
    </>
  );
}
