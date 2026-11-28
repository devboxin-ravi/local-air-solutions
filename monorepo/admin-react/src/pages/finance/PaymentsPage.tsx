/**
 * Payments ledger and UPI verification queue (approve / reject with notes).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, PlusCircle, RotateCcw, XCircle } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useManualPayment, usePaymentActions, usePaymentList, useReceivingAccounts } from '@/hooks/useFinance';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { MANUAL_PAYMENT, PAYMENT_METHODS, RECEIVE_PAYMENT, PLACEHOLDERS, ROW_ACTIONS } from '@/constants/ui';
import { assetUrl, formatDate, formatDateTime, formatMoney, humanize, toNumber } from '@/lib/utils';
import type { Payment } from '@/types';
import { ConfirmDialog, Field, PageHeader, StatusBadge } from '@/components/common';
import { useFormErrors } from '@/hooks/useFormErrors';
import { refundSchema } from '@/lib/validation';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { Button, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { RecordPaymentDialog } from '@/components/FinanceWidgets';
import { CustomerPicker } from '@/components/Pickers';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

/** Page of the record a payment was made against (invoice, else booking, else AMC). */
const paymentSourceRoute = (p: Payment): string | null =>
  p.invoice ? ROUTES.INVOICE_DETAIL(p.invoice.id) : p.booking ? ROUTES.BOOKING_DETAIL(p.booking.id) : p.amcContract ? ROUTES.AMC_DETAIL(p.amcContract.id) : null;

export default function PaymentsPage({ verification }: { verification?: boolean }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState();
  const { data, isLoading, error, refetch } = usePaymentList({ ...list.query, ...(verification ? { status: 'PENDING_VERIFICATION' } : {}) });
  const actions = usePaymentActions();
  const manual = useManualPayment();
  const { data: accounts } = useReceivingAccounts();
  const [account, setAccount] = useState('');
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
    { key: 'method', header: 'Method', cell: (p) => <div><p>{humanize(p.method)}</p>{p.receivingAccount && <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={p.receivingAccount}>{p.receivingAccount}</p>}{p.receivedBy && <p className="text-xs text-muted-foreground">By {p.receivedBy}</p>}</div> },
    { key: 'ref', header: 'Reference', cell: (p) => <div className="flex items-center gap-1.5"><span className="font-mono text-xs">{p.referenceNumber ?? '—'}</span>{p.proofPath && <a href={assetUrl(p.proofPath)} target="_blank" rel="noreferrer" className="text-brand-blue" onClick={(e) => e.stopPropagation()} aria-label="View screenshot"><ExternalLink className="h-3.5 w-3.5" /></a>}</div> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <div><p className="num font-semibold">{formatMoney(p.amount)}</p>{toNumber(p.chargeAmount) > 0 && <p className="num text-xs text-muted-foreground">Charge {formatMoney(p.chargeAmount)}</p>}</div> },
    { key: 'status', header: 'Status', cell: (p) => <div><StatusBadge status={p.status} />{p.verificationNote && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted-foreground" title={p.verificationNote}>{p.verificationNote}</p>}</div> },
    {
      key: 'actions',
      header: ROW_ACTIONS.HEADER,
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          {p.status === 'PENDING_VERIFICATION' && can('payments.approve') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => { setNote(''); setAccount(''); setReview({ payment: p, approve: true }); }}><CheckCircle2 /> Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => { setNote(''); setAccount(''); setReview({ payment: p, approve: false }); }}><XCircle className="text-red-500" /> Reject</Button>
            </>
          )}
          {p.status === 'VERIFIED' && can('payments.approve') && <Button size="sm" variant="ghost" onClick={() => { setRefund(p); setRefundAmount(String(toNumber(p.amount))); }}><RotateCcw /> Refund</Button>}
          <RowActions onView={paymentSourceRoute(p) ? () => navigate(paymentSourceRoute(p) as string) : undefined} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={verification ? 'Payment Verification' : 'Payment Receipt'}
        description={verification ? 'Payments received by technicians, staff or customers. Confirm once the money reaches the office: cash goes to cash in hand, UPI/bank to the chosen account. Only verified payments update invoices and the ledger.' : 'All recorded payments.'}
        breadcrumbs={[{ label: 'Accounts', to: ROUTES.INVOICES }, { label: verification ? 'Payment Verification' : 'Payment Receipt' }]}
        actions={!verification && can('payments.create') && <Button onClick={() => manual.setOpen(true)}><PlusCircle /> {MANUAL_PAYMENT.BUTTON}</Button>}
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
      <RecordPaymentDialog
        open={manual.open}
        onOpenChange={manual.setOpen}
        context={MANUAL_PAYMENT.CONTEXT}
        defaultAmount={manual.balance}
        maxAmount={manual.balance}
        submitting={manual.submitting}
        onSubmit={manual.submit}
        accounts={accounts}
      >
        <Field label={MANUAL_PAYMENT.CUSTOMER_LABEL} required error={manual.customerError ? MANUAL_PAYMENT.CUSTOMER_REQUIRED : undefined}>
          <CustomerPicker value={manual.customer} options={manual.customers} loading={manual.customersLoading} search={manual.search} onSearchChange={manual.setSearch} onSelect={manual.selectCustomer} invalid={manual.customerError} />
        </Field>
        {manual.customer && (
          <Field label={MANUAL_PAYMENT.INVOICE_LABEL} hint={manual.invoices.length ? MANUAL_PAYMENT.INVOICE_HINT : MANUAL_PAYMENT.NO_OUTSTANDING}>
            <NativeSelect value={manual.invoiceId ?? ''} disabled={manual.invoicesLoading} onChange={(e) => manual.setInvoiceId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{MANUAL_PAYMENT.NO_INVOICE}</option>
              {manual.invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} · {formatDate(i.invoiceDate)} · balance {formatMoney(i.balanceDue)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </RecordPaymentDialog>
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
        onConfirm={(reason) => review && actions.verify.mutate({ id: review.payment.id, approve: review.approve, note: reason || note || undefined, account: account ? Number(account) : undefined }, { onSuccess: () => setReview(null) })}
      >
        {review?.approve && review.payment.method === 'CASH' && <p className="text-[13px] font-medium text-brand-navy">{RECEIVE_PAYMENT.CASH_DESTINATION}</p>}
        {review?.approve && review.payment.method !== 'CASH' && review.payment.method !== 'RAZORPAY' && !!accounts?.accounts.length && (
          <Field label={RECEIVE_PAYMENT.BANK_LABEL} hint={review.payment.receivingAccount ? `Currently: ${review.payment.receivingAccount}` : undefined}>
            <NativeSelect value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">Keep as is</option>
              {accounts.accounts.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label} · {a.upiId}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </ConfirmDialog>
      <Dialog open={!!refund} onOpenChange={(o) => { if (!o) { setRefund(null); refundErrors.reset(); } }}>
        <DialogContent size="sm">
          <DialogHeader title="Record refund" description="Posts a REFUND entry to the ledger and re-opens the invoice balance." />
          <DialogBody className="space-y-4">
            <Field label="Amount (₹)" required error={refundErrors.errors.amount} htmlFor="refund-amount" hint={refund ? `Up to ${formatMoney(refund.amount)}` : undefined}>
              <Input id="refund-amount" placeholder={PLACEHOLDERS.AMOUNT} type="number" inputMode="decimal" min="0.01" max={toNumber(refund?.amount)} step="0.01" value={refundAmount} onChange={(e) => { setRefundAmount(e.target.value); refundErrors.clear('amount'); }} />
            </Field>
            <Field label="Reason" required error={refundErrors.errors.reason} htmlFor="refund-reason" counter={{ value: note.length, max: 1000 }}>
              <Textarea id="refund-reason" placeholder={PLACEHOLDERS.REASON} value={note} onChange={(e) => { setNote(e.target.value); refundErrors.clear('reason'); }} maxLength={1000} />
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
