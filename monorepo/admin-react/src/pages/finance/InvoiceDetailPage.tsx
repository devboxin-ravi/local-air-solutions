/**
 * Invoice view: branded preview, PDF/print, WhatsApp/email sharing, payments, cancellation.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BellRing, Download, IndianRupee, Mail, MessageCircle, Printer, Users, XCircle } from 'lucide-react';
import { useInvoice, useInvoiceActions, usePaymentActions, useReceivingAccounts } from '@/hooks/useFinance';
import { useTechnicians } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { SERIAL_COLUMN } from '@/constants/ui';
import { cn, formatDate, formatMoney, humanize, serialNumber, toNumber } from '@/lib/utils';
import { Badge, BrandLogo, ConfirmDialog, ErrorState, LoadingBlock, PageHeader, SectionCard, StatusBadge } from '@/components/common';
import { RecordPaymentDialog, TotalsSummary } from '@/components/FinanceWidgets';
import { ChipMultiSelect } from '@/components/Pickers';
import { Button, Card } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';
import { useGoBack } from '@/hooks/useGoBack';

interface Snapshot {
  company?: { name?: string; legalName?: string; address?: string; phone?: string; email?: string; website?: string; gstin?: string; stateCode?: string; tagline?: string };
  branch?: { name?: string; address?: string; phone?: string; gstin?: string } | null;
  customer?: { name?: string; code?: string; mobile?: string; email?: string; address?: string };
}

export default function InvoiceDetailPage() {
  const goBack = useGoBack(ROUTES.INVOICES);
  const id = Number(useParams().id);
  const { can } = useAuth();
  const { data: inv, isLoading, error, refetch } = useInvoice(id);
  const actions = useInvoiceActions();
  const pay = usePaymentActions();
  // Staff of the invoice's own branch.
  const { data: staff } = useTechnicians(inv?.branchId);
  const { data: accounts } = useReceivingAccounts();
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [staffIds, setStaffIds] = useState<number[]>([]);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !inv) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />;

  const snap = (inv as unknown as { snapshot?: Snapshot }).snapshot ?? {};
  const balance = toNumber(inv.balanceDue);
  const cancelled = inv.status === 'CANCELLED';

  return (
    <>
      <PageHeader onBack={goBack}
        title={inv.invoiceNumber}
        description={`${inv.customer.fullName} · ${formatDate(inv.invoiceDate)}`}
        breadcrumbs={[{ label: 'Accounts', to: ROUTES.INVOICES }, { label: 'Invoices', to: ROUTES.INVOICES }, { label: inv.invoiceNumber }]}
        actions={
          <>
            <Button variant="outline" onClick={() => actions.downloadPdf(inv.id, inv.invoiceNumber)}><Download /> PDF</Button>
            <Button variant="outline" onClick={() => actions.downloadPdf(inv.id, inv.invoiceNumber, true)}><Printer /> Print</Button>
            <Button variant="outline" loading={actions.whatsapp.isPending} onClick={() => actions.whatsapp.mutate({ id: inv.id, invoiceNumber: inv.invoiceNumber })}><MessageCircle className="text-green-600" /> WhatsApp</Button>
            <Button variant="outline" onClick={() => setShareOpen(true)}><Mail /> Email</Button>
            {!cancelled && balance > 0 && <Button variant="outline" onClick={() => actions.paymentReminder.mutate(inv.id)}><BellRing /> Payment reminder</Button>}
            {!cancelled && balance > 0 && can('payments.create') && <Button onClick={() => setPayOpen(true)}><IndianRupee /> Receive payment</Button>}
            {!cancelled && can('invoices.delete') && toNumber(inv.amountPaid) === 0 && <Button variant="ghost" onClick={() => setCancelOpen(true)}><XCircle className="text-red-500" /> Cancel</Button>}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Invoice preview */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-brand-blue via-brand-blue-400 to-brand-green-500" />
          <div className="p-6 sm:p-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <BrandLogo className="h-12" />
              <div className="text-left sm:text-right">
                <p className="font-display text-2xl font-extrabold text-brand-navy">{inv.isFreeService ? 'FREE SERVICE INVOICE' : 'INVOICE'}</p>
                <p className="num mt-1 text-[13px] text-slate-600">{inv.invoiceNumber} · {formatDate(inv.invoiceDate)}</p>
                <div className="mt-2 flex gap-1.5 sm:justify-end"><StatusBadge status={inv.status} />{inv.isFreeService && <Badge tone="green">Free service</Badge>}</div>
              </div>
            </div>
            <div className="mt-8 grid gap-6 border-t border-brand-green-200 pt-6 sm:grid-cols-2">
              <div className="text-[13px]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From</p>
                {/* Settings → Company Profile (same as the PDF); the branch adds its name and, if separately registered, its GSTIN. */}
                <p className="mt-1 font-semibold text-brand-navy">{snap.company?.legalName || snap.company?.name}</p>
                {(snap.company?.address || snap.branch?.address) && <p className="whitespace-pre-line text-slate-600">{snap.company?.address || snap.branch?.address}</p>}
                {snap.branch?.name && <p className="text-slate-600">Branch: {snap.branch.name}</p>}
                {(snap.company?.phone || snap.branch?.phone || snap.company?.email) && (
                  <p className="text-slate-600">{[snap.company?.phone || snap.branch?.phone, snap.company?.email].filter(Boolean).join(' · ')}</p>
                )}
                {snap.company?.website && <p className="text-slate-600">{snap.company.website}</p>}
                {(snap.branch?.gstin || snap.company?.gstin) && (
                  <p className="text-slate-600">
                    GSTIN: {snap.branch?.gstin || snap.company?.gstin}
                    {!snap.branch?.gstin && snap.company?.stateCode ? ` · State code: ${snap.company.stateCode}` : ''}
                  </p>
                )}
              </div>
              <div className="text-[13px]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bill to</p>
                <p className="mt-1 font-semibold text-brand-navy">{snap.customer?.name}</p>
                <p className="text-slate-600">{snap.customer?.code} · {snap.customer?.mobile}</p>
                <p className="text-slate-600">{snap.customer?.address}</p>
              </div>
            </div>
            <div className="scrollbar-thin mt-8 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="bg-brand-blue text-left text-[11.5px] font-semibold uppercase tracking-wide text-white">
                    <th className={cn('rounded-l-lg px-3 py-2.5', SERIAL_COLUMN.CLASS)}>{SERIAL_COLUMN.HEADER}</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">SAC</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Disc.</th>
                    <th className="px-3 py-2.5 text-right">GST</th>
                    <th className="rounded-r-lg px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inv.items?.map((it, index) => (
                    <tr key={it.id}>
                      <td className={cn('px-3 py-3', SERIAL_COLUMN.CLASS, SERIAL_COLUMN.CELL_TEXT)}>{serialNumber(index)}</td>
                      <td className="px-3 py-3 font-medium text-brand-navy">{it.description}</td>
                      <td className="px-3 py-3 text-slate-500">{it.hsnSac ?? '—'}</td>
                      <td className="num px-3 py-3 text-right">{it.quantity}</td>
                      <td className="num px-3 py-3 text-right">{formatMoney(it.rate)}</td>
                      <td className="num px-3 py-3 text-right">{toNumber(it.discount) ? formatMoney(it.discount) : '—'}</td>
                      <td className="num px-3 py-3 text-right">{toNumber(it.gstRate)}%</td>
                      <td className="num px-3 py-3 text-right font-semibold">{formatMoney(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <TotalsSummary totals={{ subtotal: toNumber(inv.subtotal), discount: toNumber(inv.discount), taxableAmount: toNumber(inv.taxableAmount), cgst: toNumber(inv.cgst), sgst: toNumber(inv.sgst), igst: toNumber(inv.igst), gstTotal: toNumber(inv.gstTotal), roundOff: toNumber(inv.roundOff), grandTotal: toNumber(inv.grandTotal) }} applyGst={inv.applyGst} isInterState={inv.isInterState} />
                <div className="flex justify-between border-t pt-2 text-[13.5px]"><span className="text-muted-foreground">Paid</span><span className="num font-semibold text-brand-green-700">{formatMoney(inv.amountPaid)}</span></div>
                <div className="flex justify-between text-[13.5px]"><span className="font-semibold">Balance due</span><span className={`num font-bold ${balance > 0 ? 'text-red-600' : 'text-brand-green-700'}`}>{formatMoney(inv.balanceDue)}</span></div>
              </div>
            </div>
            {inv.amcUsage && (
              <div className="mt-6 rounded-lg border border-brand-blue-100 bg-brand-blue-50/40 p-3 text-[12.5px] text-slate-700">
                <p className="font-semibold text-brand-navy">AMC usage · {inv.amcUsage.amcNumber}</p>
                <p>
                  Plan {formatDate(inv.amcUsage.startDate)} to {formatDate(inv.amcUsage.endDate)}
                  {inv.amcUsage.visitNumber ? ` · this bill is for visit ${inv.amcUsage.visitNumber}` : ''}
                </p>
                <p>
                  Visits used {inv.amcUsage.usedVisits} of {inv.amcUsage.totalVisits}, remaining {inv.amcUsage.remainingVisits} (as on {formatDate(inv.amcUsage.asOn)})
                </p>
              </div>
            )}
            {inv.notes && <p className="mt-6 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">{inv.notes}</p>}
            <p className="mt-10 text-center font-display text-sm font-semibold italic text-brand-green-600">{snap.company?.tagline || 'Cool Comfort Care'}</p>
          </div>
        </Card>

        <div className="space-y-6">
          <SectionCard title="Links">
            <div className="space-y-2 text-[13px]">
              <p>Customer: <Link className="font-semibold text-brand-blue hover:underline" to={ROUTES.CUSTOMER_DETAIL(inv.customer.id)}>{inv.customer.fullName}</Link></p>
              {inv.booking && <p>Booking: <Link className="font-semibold text-brand-blue hover:underline" to={ROUTES.BOOKING_DETAIL(inv.booking.id)}>{inv.booking.bookingNumber}</Link></p>}
              {inv.amcContract && <p>AMC: <Link className="font-semibold text-brand-blue hover:underline" to={ROUTES.AMC_DETAIL(inv.amcContract.id)}>{inv.amcContract.amcNumber}</Link></p>}
              <p>Branch: {inv.branch.name}</p>
            </div>
          </SectionCard>
          <SectionCard title="Payments" bodyClassName="p-0">
            {!inv.payments?.length ? (
              <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-3 text-[13px]">
                    <div>
                      <p className="num font-semibold">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">{humanize(p.method)} · {p.referenceNumber ?? p.paymentNumber} · {formatDate(p.receivedAt)}</p>
                      {p.receivingAccount && <p className="text-xs text-muted-foreground">In: {p.receivingAccount}</p>}
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <RecordPaymentDialog accounts={accounts} team={inv.booking?.assignments?.map((x) => x.staff.user.name) ?? []} open={payOpen} onOpenChange={setPayOpen} defaultAmount={balance} maxAmount={balance} context={`${inv.invoiceNumber} · ${inv.customer.fullName}`} submitting={pay.record.isPending} onSubmit={(v) => pay.record.mutate({ key: crypto.randomUUID(), body: { customerId: inv.customerId, invoiceId: inv.id, method: v.method, account: v.account, receivedBy: v.receivedBy, amount: v.amount, referenceNumber: v.referenceNumber || null, receivedAt: v.receivedAt || undefined, note: v.note || null } }, { onSuccess: () => setPayOpen(false) })} />
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel invoice?" description="A reversal entry is posted to the customer ledger. The invoice record is kept for audit." confirmLabel="Cancel invoice" destructive requireReason loading={actions.cancel.isPending} onConfirm={(reason) => actions.cancel.mutate({ id: inv.id, reason }, { onSuccess: () => setCancelOpen(false) })} />
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader title="Email invoice" description={`Sends the PDF to ${inv.customer.email ?? 'the customer (no email on file)'} and any selected staff.`} />
          <DialogBody className="space-y-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700"><Users className="h-4 w-4" /> Also share with staff</p>
            <ChipMultiSelect options={(staff ?? []).map((s) => ({ id: s.userId, name: s.user.name }))} value={staffIds} onChange={setStaffIds} emptyText="No staff available" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button loading={actions.share.isPending} onClick={() => actions.share.mutate({ invoiceIds: [inv.id], channel: 'EMAIL', toCustomer: true, staffUserIds: staffIds }, { onSuccess: () => setShareOpen(false) })}><Mail /> Send email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
