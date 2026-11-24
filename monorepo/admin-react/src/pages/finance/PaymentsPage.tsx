/**
 * Payments ledger and UPI verification queue (approve / reject with notes).
 */

import { useState } from 'react';
import { CheckCircle2, ExternalLink, RotateCcw, XCircle } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { usePaymentActions, usePaymentList } from '@/hooks/useFinance';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { PAYMENT_METHODS } from '@/constants/ui';
import { assetUrl, formatDate, formatDateTime, formatMoney, humanize, toNumber } from '@/lib/utils';
import type { Payment } from '@/types';
import { ConfirmDialog, Field, PageHeader, StatusBadge } from '@/components/common';
import { useFormErrors } from '@/hooks/useFormErrors';
import { refundSchema } from '@/lib/validation';
import { DataTable, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button, Input, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

export default function PaymentsPage({ verification }: { verification?: boolean }) {
  const { can } = useAuth();
  const list = useListState();
  const { data, isLoading, error, refetch } = usePaymentList({ ...list.query, ...(verification ? { status: 'PENDING_VERIFICATION' } : {}) });
  const actions = usePaymentActions();
  const [review, setReview] = useState<{ payment: Payment; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const refundErrors = useFormErrors();
  const submitRefund = () => {
    if (!refund) return;
    const parsed = refundErrors.validate(refundSchema(toNumber(refund.amount)), { amount: refundAmount, reason: note });
    if (!parsed) return;
    actions.refund.mutate({ id: refund.id, amount: parsed.amount, reason: parsed.reason }, { onSuccess: () => setRefund(null), onError: (e) => refundErrors.fromServer(e) });
  };

  const columns: Column<Payment>[] = [
    { key: 'no', header: 'Payment', cell: (p) => <div><p className="font-semibold text-brand-navy">{p.paymentNumber}</p><p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt ?? p.receivedAt)}</p></div> },
    { key: 'customer', header: 'Customer', cell: (p) => <div><p className="font-medium">{p.customer?.fullName}</p><p className="text-xs text-muted-foreground">{p.customer?.mobile}</p></div> },
    { key: 'for', header: 'For', cell: (p) => p.invoice?.invoiceNumber ?? p.booking?.bookingNumber ?? p.amcContract?.amcNumber ?? '—' },
    { key: 'method', header: 'Method', cell: (p) => humanize(p.method) },
    { key: 'ref', header: 'Reference', cell: (p) => <div className="flex items-center gap-1.5"><span className="font-mono text-xs">{p.referenceNumber ?? '—'}</span>{p.proofPath && <a href={assetUrl(p.proofPath)} target="_blank" rel="noreferrer" className="text-brand-blue" onClick={(e) => e.stopPropagation()} aria-label="View screenshot"><ExternalLink className="h-3.5 w-3.5" /></a>}</div> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="num font-semibold">{formatMoney(p.amount)}</span> },
    { key: 'status', header: 'Status', cell: (p) => <div><StatusBadge status={p.status} />{p.verificationNote && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted-foreground" title={p.verificationNote}>{p.verificationNote}</p>}</div> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          {p.status === 'PENDING_VERIFICATION' && can('payments.approve') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => { setNote(''); setReview({ payment: p, approve: true }); }}><CheckCircle2 /> Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => { setNote(''); setReview({ payment: p, approve: false }); }}><XCircle className="text-red-500" /> Reject</Button>
            </>
          )}
          {p.status === 'VERIFIED' && can('payments.approve') && <Button size="sm" variant="ghost" onClick={() => { setRefund(p); setRefundAmount(String(toNumber(p.amount))); }}><RotateCcw /> Refund</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={verification ? 'Payment Verification' : 'Payments'}
        description={verification ? 'Customer-submitted UPI references awaiting review. Only verified payments update invoices and the ledger.' : 'All recorded payments.'}
        breadcrumbs={[{ label: 'Finance', to: ROUTES.INVOICES }, { label: verification ? 'Payment Verification' : 'Payments' }]}
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyTitle={verification ? 'Nothing to verify' : 'No payments'}
        emptyDescription={verification ? 'New UPI submissions from the customer app appear here.' : undefined}
        toolbar={
          <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Payment no., reference, customer…" />
            <SelectFilter placeholder="All methods" value={list.state.filters.method} onChange={(v) => list.setFilter('method', v)} options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
            {!verification && <SelectFilter placeholder="All statuses" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REFUNDED'].map((s) => ({ value: s, label: humanize(s) }))} />}
          </FilterBar>
        }
      />
      <ConfirmDialog
        open={!!review}
        onOpenChange={(o) => !o && setReview(null)}
        title={review?.approve ? 'Approve payment?' : 'Reject payment?'}
        description={review ? `${formatMoney(review.payment.amount)} · ref ${review.payment.referenceNumber ?? '—'} · received ${formatDate(review.payment.receivedAt)}. ${review.approve ? 'Invoice, booking and ledger are updated.' : 'The customer is notified.'}` : undefined}
        confirmLabel={review?.approve ? 'Approve' : 'Reject'}
        destructive={!review?.approve}
        requireReason={!review?.approve}
        reasonLabel="Reason (shared with customer)"
        loading={actions.verify.isPending}
        onConfirm={(reason) => review && actions.verify.mutate({ id: review.payment.id, approve: review.approve, note: reason || note || undefined }, { onSuccess: () => setReview(null) })}
      />
      <Dialog open={!!refund} onOpenChange={(o) => { if (!o) { setRefund(null); refundErrors.reset(); } }}>
        <DialogContent size="sm">
          <DialogHeader title="Record refund" description="Posts a REFUND entry to the ledger and re-opens the invoice balance." />
          <DialogBody className="space-y-4">
            <Field label="Amount (₹)" required error={refundErrors.errors.amount} htmlFor="refund-amount" hint={refund ? `Up to ${formatMoney(refund.amount)}` : undefined}>
              <Input id="refund-amount" type="number" inputMode="decimal" min="0.01" max={toNumber(refund?.amount)} step="0.01" value={refundAmount} onChange={(e) => { setRefundAmount(e.target.value); refundErrors.clear('amount'); }} />
            </Field>
            <Field label="Reason" required error={refundErrors.errors.reason} htmlFor="refund-reason" counter={{ value: note.length, max: 1000 }}>
              <Textarea id="refund-reason" value={note} onChange={(e) => { setNote(e.target.value); refundErrors.clear('reason'); }} maxLength={1000} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefund(null)}>Cancel</Button>
            <Button variant="destructive" loading={actions.refund.isPending} onClick={submitRefund}>Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
