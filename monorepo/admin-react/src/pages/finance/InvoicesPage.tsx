/**
 * Invoices list with multi-select bulk sharing (email / WhatsApp) and PDF download.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Mail, MessageCircle } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useInvoiceActions, useInvoiceList } from '@/hooks/useFinance';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ROW_ACTIONS } from '@/constants/ui';
import { formatDate, formatMoney, humanize, toNumber } from '@/lib/utils';
import type { Invoice } from '@/types';
import { Badge, ConfirmDialog, PageHeader, StatusBadge } from '@/components/common';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button } from '@/components/ui/primitives';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState();
  const { data, isLoading, error, refetch } = useInvoiceList(list.query);
  const actions = useInvoiceActions();
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [toCancel, setToCancel] = useState<Invoice | null>(null);
  const ids = Array.from(selected).map(Number);

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice', cell: (i) => <div><p className="font-semibold text-brand-blue">{i.invoiceNumber}</p><p className="text-xs text-muted-foreground">{i.booking?.bookingNumber ?? i.amcContract?.amcNumber ?? 'Manual'}</p></div> },
    { key: 'date', header: 'Date', cell: (i) => formatDate(i.invoiceDate) },
    { key: 'customer', header: 'Customer', cell: (i) => <div><p className="font-medium">{i.customer.fullName}</p><p className="text-xs text-muted-foreground">{i.customer.mobile}</p></div> },
    { key: 'gst', header: 'GST', align: 'right', cell: (i) => <span className="num">{i.applyGst ? formatMoney(i.gstTotal) : '—'}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: (i) => <span className="num font-semibold">{formatMoney(i.grandTotal)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', cell: (i) => <span className={`num ${Number(i.balanceDue) > 0 ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>{formatMoney(i.balanceDue)}</span> },
    { key: 'status', header: 'Status', cell: (i) => <div className="flex flex-wrap gap-1"><StatusBadge status={i.status} />{i.isFreeService && <Badge tone="green">Free service</Badge>}</div> },
    {
      key: 'actions',
      header: ROW_ACTIONS.HEADER,
      align: 'right',
      cell: (i) => (
        <RowActions
          onDownload={() => void actions.downloadPdf(i.id, i.invoiceNumber)}
          onView={() => navigate(ROUTES.INVOICE_DETAIL(i.id))}
          onCancel={can('invoices.delete') && i.status !== 'CANCELLED' && toNumber(i.amountPaid) === 0 ? () => setToCancel(i) : undefined}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Invoices" description="GST invoices for completed jobs, AMC contracts and manual billing." breadcrumbs={[{ label: 'Finance', to: ROUTES.INVOICES }, { label: 'Invoices' }]} actions={can('invoices.create') && <Button onClick={() => navigate(ROUTES.INVOICE_NEW)}><FilePlus2 /> Manual invoice</Button>} />
      {ids.length > 0 && (
        <div className="sticky top-[77px] lg:top-[81px] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-blue-200 bg-brand-blue-50 px-4 py-2.5 shadow-sm animate-slide-down">
          <span className="text-[13px] font-semibold text-brand-blue-800">{ids.length} selected</span>
          <Button size="sm" variant="outline" loading={actions.share.isPending} onClick={() => actions.share.mutate({ invoiceIds: ids, channel: 'EMAIL', toCustomer: true })}><Mail /> Email customers</Button>
          <Button size="sm" variant="outline" onClick={() => actions.share.mutate({ invoiceIds: ids, channel: 'WHATSAPP' })}><MessageCircle className="text-green-600" /> WhatsApp</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
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
        onRowClick={(i) => navigate(ROUTES.INVOICE_DETAIL(i.id))}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        toolbar={
          <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Invoice no., customer, mobile…" />
            <SelectFilter placeholder="All statuses" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'].map((s) => ({ value: s, label: humanize(s) }))} />
            <SelectFilter placeholder="All invoices" value={list.state.filters.isFreeService} onChange={(v) => list.setFilter('isFreeService', v)} options={[{ value: 'true', label: 'Free services' }, { value: 'false', label: 'Paid services' }]} className="sm:w-40" />
          </FilterBar>
        }
      />
      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title={`Cancel invoice ${toCancel?.invoiceNumber}?`}
        description="A cancelled invoice stays on record (GST audit trail) but no longer counts as due."
        confirmLabel="Cancel invoice"
        destructive
        requireReason
        loading={actions.cancel.isPending}
        onConfirm={(reason) => toCancel && actions.cancel.mutate({ id: toCancel.id, reason }, { onSuccess: () => setToCancel(null) })}
      />
    </>
  );
}
