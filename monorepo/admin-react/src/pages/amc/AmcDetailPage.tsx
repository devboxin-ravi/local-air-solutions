/**
 * AMC detail: lifecycle actions (invoice → payment → activate), visits with booking, billing.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, FileText, IndianRupee, Power, XCircle } from 'lucide-react';
import { useAmc, useAmcActions, usePaymentActions } from '@/hooks/useFinance';
import { useAvailableSlots } from '@/hooks/useOperations';
import { useTechnicians } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { cn, formatDate, formatMoney, toNumber, toYmd } from '@/lib/utils';
import type { AmcVisit } from '@/types';
import { ConfirmDialog, ErrorState, Field, KeyValue, LoadingBlock, PageHeader, SectionCard, StatusBadge } from '@/components/common';
import { SlotGrid } from '@/components/Pickers';
import { RecordPaymentDialog } from '@/components/FinanceWidgets';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';
import { useGoBack } from '@/hooks/useGoBack';

const STEPS = ['DRAFT', 'PENDING_PAYMENT', 'ACTIVE'];

export default function AmcDetailPage() {
  const goBack = useGoBack(ROUTES.AMC);
  const id = Number(useParams().id);
  const { can } = useAuth();
  const { data: a, isLoading, error, refetch } = useAmc(id);
  const actions = useAmcActions();
  const pay = usePaymentActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [visit, setVisit] = useState<AmcVisit | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [slotId, setSlotId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<string>('');
  const slots = useAvailableSlots(visit ? a?.branchId : undefined, visitDate);
  const { data: techs } = useTechnicians(a?.branchId);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !a) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />;

  const invoice = a.invoices?.find((i) => i.status !== 'CANCELLED');
  const stepIdx = STEPS.indexOf(a.status === 'EXPIRING' ? 'ACTIVE' : a.status);

  return (
    <>
      <PageHeader onBack={goBack}
        title={a.amcNumber}
        description={`${a.customer.fullName} · ${a.productDetails}`}
        breadcrumbs={[{ label: 'AMC', to: ROUTES.AMC }, { label: a.amcNumber }]}
        actions={
          <>
            <StatusBadge status={a.status} className="px-3 py-1 text-[12.5px]" />
            {a.status === 'DRAFT' && can('amc.edit') && <Button loading={actions.issueInvoice.isPending} onClick={() => actions.issueInvoice.mutate(id)}><FileText /> Issue invoice</Button>}
            {a.status === 'PENDING_PAYMENT' && can('payments.create') && invoice && <Button variant="secondary" onClick={() => setPayOpen(true)}><IndianRupee /> Record payment</Button>}
            {a.status === 'PENDING_PAYMENT' && can('amc.approve') && <Button variant="outline" loading={actions.activate.isPending} onClick={() => actions.activate.mutate(id)}><Power /> Activate</Button>}
            {!['CANCELLED', 'EXPIRED'].includes(a.status) && can('amc.approve') && <Button variant="ghost" onClick={() => setCancelOpen(true)}><XCircle className="text-red-500" /> Cancel</Button>}
          </>
        }
      />

      {stepIdx >= 0 && (
        <Card className="mb-6 p-5">
          <ol className="flex items-center gap-2">
            {['Draft', 'Invoice issued', 'Active & visits scheduled'].map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', i <= stepIdx ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500')}>{i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</span>
                <span className={cn('text-[13px] font-semibold', i <= stepIdx ? 'text-brand-navy' : 'text-slate-400')}>{label}</span>
                {i < 2 && <span className={cn('h-0.5 flex-1 rounded', i < stepIdx ? 'bg-brand-blue' : 'bg-slate-200')} />}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <SectionCard title="Contract">
            <KeyValue columns={3} items={[
              { label: 'Customer', value: <Link className="text-brand-blue hover:underline" to={ROUTES.CUSTOMER_DETAIL(a.customer.id)}>{a.customer.fullName}</Link> },
              { label: 'Mobile', value: a.customer.mobile },
              { label: 'Branch', value: a.branch.name },
              { label: 'Period', value: `${formatDate(a.startDate)} → ${formatDate(a.endDate)}` },
              { label: 'Visits', value: `${a.totalVisits} · every ${a.visitFrequencyMonths} month(s)` },
              { label: 'Contract value', value: <span className="num">{formatMoney(a.contractAmount)}{a.applyGst ? ' + GST' : ''}</span> },
              { label: 'Address', value: a.address ? `${a.address.line1}, ${a.address.city.name} ${a.address.pincode}` : '—' },
              { label: 'Covered services', value: a.services?.map((s) => s.service.name).join(', ') },
            ]} />
            {a.terms && <p className="mt-5 whitespace-pre-line rounded-lg bg-slate-50 p-3.5 text-[13px] text-slate-600">{a.terms}</p>}
          </SectionCard>

          <SectionCard title="Visits" description="Every visit stays linked to this contract." bodyClassName="p-0">
            {!a.visits?.length ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Visits are scheduled when the AMC is activated.</p>
            ) : (
              <ul className="divide-y">
                {a.visits.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue-50 font-bold text-brand-blue">{v.visitNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-brand-navy">Visit {v.visitNumber} · {formatDate(v.scheduledDate)}</p>
                      {v.booking ? <Link to={ROUTES.BOOKING_DETAIL(v.booking.id)} className="text-xs text-brand-blue hover:underline">{v.booking.bookingNumber} · {v.booking.status.replace(/_/g, ' ').toLowerCase()}</Link> : <p className="text-xs text-muted-foreground">Not booked yet</p>}
                    </div>
                    <StatusBadge status={v.status} />
                    {v.status === 'SCHEDULED' && ['ACTIVE', 'EXPIRING'].includes(a.status) && can('amc.edit') && (
                      <Button size="sm" variant="soft" onClick={() => { setVisit(v); setVisitDate(v.scheduledDate.slice(0, 10) < toYmd(new Date()) ? toYmd(new Date()) : v.scheduledDate.slice(0, 10)); setSlotId(null); setStaffId(''); }}>
                        <CalendarPlus /> Book visit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className="space-y-6">
          <SectionCard title="Billing">
            <div className="space-y-3 text-[13px]">
              {a.invoices?.map((i) => (
                <Link key={i.id} to={ROUTES.INVOICE_DETAIL(i.id)} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50">
                  <span><span className="font-semibold text-brand-blue">{i.invoiceNumber}</span><span className="block text-xs text-muted-foreground">{formatMoney(i.grandTotal)} · balance {formatMoney(i.balanceDue)}</span></span>
                  <StatusBadge status={i.status} />
                </Link>
              ))}
              {!a.invoices?.length && <p className="text-muted-foreground">No invoice yet.</p>}
              {a.payments?.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-1">
                  <span className="num">{formatMoney(p.amount)} · {p.method.replace('_', ' ')}</span>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel AMC?" description="Scheduled (unbooked) visits are cancelled. Invoices must be handled separately." confirmLabel="Cancel AMC" destructive requireReason loading={actions.cancel.isPending} onConfirm={(reason) => actions.cancel.mutate({ id, reason }, { onSuccess: () => setCancelOpen(false) })} />
      {invoice && (
        <RecordPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          defaultAmount={toNumber(invoice.balanceDue)}
          maxAmount={toNumber(invoice.balanceDue)}
          context={`${a.amcNumber} · ${invoice.invoiceNumber}`}
          submitting={pay.record.isPending}
          onSubmit={(v) => pay.record.mutate({ key: crypto.randomUUID(), body: { customerId: a.customerId, invoiceId: invoice.id, amcContractId: a.id, method: v.method, amount: v.amount, referenceNumber: v.referenceNumber || null, receivedAt: v.receivedAt || undefined, note: v.note || null } }, { onSuccess: () => setPayOpen(false) })}
        />
      )}
      <Dialog open={!!visit} onOpenChange={(o) => !o && setVisit(null)}>
        <DialogContent size="lg">
          <DialogHeader title={`Book visit ${visit?.visitNumber}`} description="Creates a zero-value booking linked to this AMC." />
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" required error={visitDate && visitDate < toYmd(new Date()) ? 'Date cannot be in the past' : undefined}><Input type="date" value={visitDate} min={toYmd(new Date())} onChange={(e) => { setVisitDate(e.target.value); setSlotId(null); }} /></Field>
              <Field label="Technician (optional)">
                <NativeSelect searchable value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">Assign later</option>
                  {techs?.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Slot"><SlotGrid slots={slots.data} loading={slots.isLoading} value={slotId} onChange={setSlotId} /></Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisit(null)}>Cancel</Button>
            <Button disabled={!visitDate || visitDate < toYmd(new Date())} loading={actions.bookVisit.isPending} onClick={() => visit && actions.bookVisit.mutate({ id: visit.id, scheduledDate: visitDate, slotId, staffId: staffId ? Number(staffId) : null }, { onSuccess: () => setVisit(null) })}>Book visit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
