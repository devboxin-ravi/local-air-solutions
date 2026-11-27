/**
 * Customer 360° profile: personal info, addresses, bookings, service history, invoices,
 * payments, ledger, AMC, reminders and notes.
 */

import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, MapPin, Navigation, Pencil, Phone, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useCustomer, useCustomerBookings, useLedger } from '@/hooks/usePeople';
import { useAddressEditor } from '@/hooks/useAddressEditor';
import { useAmcList, useInvoiceList, usePaymentList } from '@/hooks/useFinance';
import { useReminderList } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { formatDate, formatDateTime, formatMoney, humanize, initials, mapsDirectionsUrl } from '@/lib/utils';
import type { Address, AmcContract, Booking, Invoice, LedgerEntry, Payment, Reminder } from '@/types';
import { Badge, EmptyState, ErrorState, KeyValue, LoadingBlock, PageHeader, SectionCard, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { AddressFields } from '@/components/AddressFields';
import { Avatar, Button, Card, Checkbox, Label } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { useGoBack } from '@/hooks/useGoBack';

export default function CustomerDetailPage() {
  const goBack = useGoBack(ROUTES.CUSTOMERS);
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: c, isLoading, error, refetch } = useCustomer(id);
  const addr = useAddressEditor(id);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !c) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader onBack={goBack}
        title={c.fullName}
        breadcrumbs={[{ label: 'Customers', to: ROUTES.CUSTOMERS }, { label: c.customerCode }]}
        actions={
          <>
            {can('customers.edit') && <Button variant="outline" onClick={() => navigate(`/customers/${id}/edit`)}><Pencil /> Edit</Button>}
            {can('amc.create') && <Button variant="outline" onClick={() => navigate(`${ROUTES.AMC_NEW}?customerId=${id}`)}><ShieldCheck /> New AMC</Button>}
            {can('bookings.create') && <Button onClick={() => navigate(`${ROUTES.BOOKING_NEW}?customerId=${id}`)}><CalendarPlus /> New booking</Button>}
          </>
        }
      />
      <Card className="mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <Avatar fallback={initials(c.fullName)} className="h-16 w-16 text-lg" />
        <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-5">
          <Info label="Customer ID" value={c.customerCode} />
          <Info label="Mobile" value={<a href={`tel:${c.countryCode}${c.mobile}`} className="inline-flex items-center gap-1 hover:text-brand-blue"><Phone className="h-3.5 w-3.5" /> {c.countryCode} {c.mobile}</a>} />
          <Info label="Branch" value={c.branch?.name ?? '—'} />
          <Info label="Type" value={humanize(c.customerType)} />
          <Info label="Status" value={<div className="flex gap-1.5"><StatusBadge status={c.status} />{c.user && <Badge tone="cyan">App</Badge>}</div>} />
        </div>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          {['personal', 'addresses', 'bookings', 'history', 'invoices', 'payments', 'ledger', 'amc', 'reminders', 'notes'].map((t) => (
            <TabsTrigger key={t} value={t}>{t === 'history' ? 'Service History' : t === 'amc' ? 'AMC' : humanize(t)}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="personal">
          <SectionCard title="Personal information">
            <KeyValue columns={3} items={[
              { label: 'Full name', value: c.fullName },
              { label: 'Email', value: c.email ?? '—' },
              { label: 'Alternate contact', value: c.alternateMobile ?? '—' },
              { label: 'Registered', value: formatDate(c.createdAt) },
              { label: 'Reminder interval', value: c.reminderIntervalMonths ? `${c.reminderIntervalMonths} months` : 'Service default' },
              { label: 'Last app login', value: c.user?.lastLoginAt ? formatDateTime(c.user.lastLoginAt) : '—' },
            ]} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="addresses">
          <div className="mb-4 flex justify-end">{can('customers.edit') && <Button onClick={addr.openNew}><Plus /> Add address</Button>}</div>
          {!c.addresses.length ? (
            <Card><EmptyState icon={MapPin} title="No addresses" /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {c.addresses.map((a: Address) => (
                <Card key={a.id} className="flex flex-col p-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand-green-600" />
                    <p className="font-display font-bold text-brand-navy">{a.label}</p>
                    {a.isDefault && <Badge tone="green"><Star className="h-3 w-3" /> Default</Badge>}
                  </div>
                  <p className="mt-2 flex-1 text-[13.5px] text-slate-600">{[a.line1, a.line2, a.landmark, a.city?.name, a.state?.name, a.pincode].filter(Boolean).join(', ')}</p>
                  {a.serviceArea && <p className="mt-1 text-xs text-muted-foreground">Service area: {a.serviceArea.name}</p>}
                  <p className="mt-1 text-xs">{a.latitude ? <span className="text-brand-green-700">📍 {String(a.latitude)}, {String(a.longitude)}</span> : <span className="text-amber-600">No coordinates</span>}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="soft" asChild><a href={mapsDirectionsUrl(a.latitude, a.longitude, `${a.line1} ${a.city?.name ?? ''} ${a.pincode}`)} target="_blank" rel="noreferrer"><Navigation /> Map</a></Button>
                    {can('customers.edit') && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => addr.openEdit(a)}><Pencil /> Edit</Button>
                        {!a.isDefault && <Button size="sm" variant="ghost" onClick={() => addr.setDefault(a.id)}><Star /> Make default</Button>}
                        <Button size="sm" variant="ghost" onClick={() => addr.remove(a.id)}><Trash2 className="text-red-500" /></Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookings"><BookingsTab customerId={id} /></TabsContent>
        <TabsContent value="history"><BookingsTab customerId={id} status="COMPLETED" /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab customerId={id} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab customerId={id} /></TabsContent>
        <TabsContent value="ledger"><LedgerTab customerId={id} /></TabsContent>
        <TabsContent value="amc"><AmcTab customerId={id} /></TabsContent>
        <TabsContent value="reminders"><RemindersTab customerId={id} /></TabsContent>
        <TabsContent value="notes">
          <SectionCard title="Notes">
            <p className="whitespace-pre-line text-[13.5px] text-slate-700">{c.notes || 'No notes. Edit the customer to add notes.'}</p>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={addr.open} onOpenChange={addr.setOpen}>
        <DialogContent size="lg">
          <DialogHeader title={addr.editing ? 'Edit address' : 'Add address'} description="Coordinates are optional — only enter verified values." />
          <form onSubmit={addr.save} noValidate>
            <DialogBody className="space-y-4">
              <AddressFields register={addr.form.register} errors={addr.form.formState.errors as never} states={addr.states} cities={addr.cities} />
              <label className="flex items-center gap-2">
                <Checkbox checked={!!addr.form.watch('isDefault')} onCheckedChange={(v) => addr.form.setValue('isDefault', !!v)} />
                <Label>Set as default address</Label>
              </label>
              {addr.error && <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">{addr.error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => addr.setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={addr.saving}>Save address</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="mt-0.5 truncate text-[13.5px] font-semibold text-brand-navy">{value}</div>
  </div>
);

const BookingsTab = ({ customerId, status }: { customerId: number; status?: string }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCustomerBookings(customerId, { status, pageSize: 50 });
  const cols: Column<Booking>[] = [
    { key: 'no', header: 'Booking', cell: (b) => <span className="font-semibold text-brand-blue">{b.bookingNumber}</span> },
    { key: 'svc', header: 'Service', cell: (b) => b.items.map((i) => i.serviceName).join(', ') || b.problemDescription },
    { key: 'date', header: status ? 'Completed' : 'Scheduled', cell: (b) => formatDate(status ? b.completedAt : b.scheduledDate) },
    { key: 'tech', header: 'Technician', cell: (b) => b.assignments[0]?.staff.user.name ?? '—' },
    { key: 'amt', header: 'Amount', align: 'right', cell: (b) => <span className="num">{formatMoney(b.estimatedTotal)}</span> },
    { key: 'st', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
  ];
  return <DataTable columns={cols} rows={data?.items} rowKey={(b) => b.id} loading={isLoading} error={error ? (error as Error).message : null} onRowClick={(b) => navigate(ROUTES.BOOKING_DETAIL(b.id))} emptyTitle={status ? 'No completed services yet' : 'No bookings yet'} dense />;
};

const InvoicesTab = ({ customerId }: { customerId: number }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useInvoiceList({ customerId, pageSize: 50 });
  const cols: Column<Invoice>[] = [
    { key: 'no', header: 'Invoice', cell: (i) => <span className="font-semibold text-brand-blue">{i.invoiceNumber}</span> },
    { key: 'date', header: 'Date', cell: (i) => formatDate(i.invoiceDate) },
    { key: 'total', header: 'Total', align: 'right', cell: (i) => <span className="num">{formatMoney(i.grandTotal)}</span> },
    { key: 'bal', header: 'Balance', align: 'right', cell: (i) => <span className="num">{formatMoney(i.balanceDue)}</span> },
    { key: 'st', header: 'Status', cell: (i) => <div className="flex gap-1"><StatusBadge status={i.status} />{i.isFreeService && <Badge tone="green">Free</Badge>}</div> },
  ];
  return <DataTable columns={cols} rows={data?.items} rowKey={(i) => i.id} loading={isLoading} error={error ? (error as Error).message : null} onRowClick={(i) => navigate(ROUTES.INVOICE_DETAIL(i.id))} emptyTitle="No invoices" dense />;
};

const PaymentsTab = ({ customerId }: { customerId: number }) => {
  const { data, isLoading, error } = usePaymentList({ customerId, pageSize: 50 });
  const cols: Column<Payment>[] = [
    { key: 'no', header: 'Payment', cell: (p) => <span className="font-semibold">{p.paymentNumber}</span> },
    { key: 'date', header: 'Date', cell: (p) => formatDate(p.receivedAt) },
    { key: 'm', header: 'Method', cell: (p) => humanize(p.method) },
    { key: 'ref', header: 'Reference', cell: (p) => p.referenceNumber ?? '—' },
    { key: 'amt', header: 'Amount', align: 'right', cell: (p) => <span className="num font-semibold">{formatMoney(p.amount)}</span> },
    { key: 'st', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
  ];
  return <DataTable columns={cols} rows={data?.items} rowKey={(p) => p.id} loading={isLoading} error={error ? (error as Error).message : null} emptyTitle="No payments" dense />;
};

export const LedgerTab = ({ customerId }: { customerId: number }) => {
  const { data, isLoading, error } = useLedger(customerId, { pageSize: 100 });
  const cols: Column<LedgerEntry>[] = [
    { key: 'date', header: 'Date', cell: (l) => formatDate(l.entryDate) },
    { key: 'ref', header: 'Reference', cell: (l) => l.referenceNumber ?? '—' },
    { key: 'type', header: 'Type', cell: (l) => <Badge tone={l.entryType === 'PAYMENT' ? 'green' : l.entryType === 'INVOICE' ? 'blue' : 'neutral'}>{humanize(l.entryType)}</Badge> },
    { key: 'desc', header: 'Description', cell: (l) => <span className="line-clamp-1">{l.description}</span> },
    { key: 'dr', header: 'Debit', align: 'right', cell: (l) => <span className="num">{Number(l.debit) ? formatMoney(l.debit) : '—'}</span> },
    { key: 'cr', header: 'Credit', align: 'right', cell: (l) => <span className="num text-brand-green-700">{Number(l.credit) ? formatMoney(l.credit) : '—'}</span> },
    { key: 'bal', header: 'Balance', align: 'right', cell: (l) => <span className="num font-semibold">{formatMoney(l.balanceAfter)}</span> },
  ];
  return (
    <div className="space-y-4">
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile label="Total billed (debit)" value={formatMoney(data.summary.totalDebit)} />
          <SummaryTile label="Total received (credit)" value={formatMoney(data.summary.totalCredit)} tone="green" />
          <SummaryTile label={data.summary.balance >= 0 ? 'Outstanding balance' : 'Advance / credit'} value={formatMoney(Math.abs(data.summary.balance))} tone={data.summary.balance > 0 ? 'red' : 'green'} />
        </div>
      )}
      <DataTable columns={cols} rows={data?.items} rowKey={(l) => l.id} loading={isLoading} error={error ? (error as Error).message : null} emptyTitle="No ledger entries" dense />
    </div>
  );
};

export const SummaryTile = ({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'green' | 'red' }) => (
  <Card className="p-4">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className={`num mt-1 font-display text-xl font-extrabold ${tone === 'green' ? 'text-brand-green-700' : tone === 'red' ? 'text-red-600' : 'text-brand-navy'}`}>{value}</p>
  </Card>
);

const AmcTab = ({ customerId }: { customerId: number }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAmcList({ customerId, pageSize: 50 });
  const cols: Column<AmcContract>[] = [
    { key: 'no', header: 'AMC', cell: (a) => <span className="font-semibold text-brand-blue">{a.amcNumber}</span> },
    { key: 'prod', header: 'Product', cell: (a) => a.productDetails },
    { key: 'period', header: 'Period', cell: (a) => `${formatDate(a.startDate)} → ${formatDate(a.endDate)}` },
    { key: 'visits', header: 'Visits', cell: (a) => `${a.completedVisits ?? 0}/${a.totalVisits}` },
    { key: 'st', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
  ];
  return <DataTable columns={cols} rows={data?.items} rowKey={(a) => a.id} loading={isLoading} error={error ? (error as Error).message : null} onRowClick={(a) => navigate(ROUTES.AMC_DETAIL(a.id))} emptyTitle="No AMC contracts" dense />;
};

const RemindersTab = ({ customerId }: { customerId: number }) => {
  const { data, isLoading, error } = useReminderList({ customerId, bucket: 'all', pageSize: 50 });
  const cols: Column<Reminder>[] = [
    { key: 'svc', header: 'Service', cell: (r) => r.service?.name ?? (r.amcContract ? `AMC ${r.amcContract.amcNumber}` : 'General') },
    { key: 'due', header: 'Due', cell: (r) => formatDate(r.dueDate) },
    { key: 'from', header: 'From booking', cell: (r) => (r.booking ? <Link className="text-brand-blue hover:underline" to={ROUTES.BOOKING_DETAIL(r.booking.id)}>{r.booking.bookingNumber}</Link> : '—') },
    { key: 'st', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable columns={cols} rows={data?.items} rowKey={(r) => r.id} loading={isLoading} error={error ? (error as Error).message : null} emptyTitle="No reminders" dense />;
};
