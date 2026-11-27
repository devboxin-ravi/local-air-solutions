/**
 * Booking detail: summary, workflow actions, technician, timeline, notes, photos, billing.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightLeft, CalendarClock, ChevronDown, Download, FileText, HardHat, IndianRupee, MapPin, MessageCircle, Navigation, Phone, Send, ShieldCheck, UserMinus, XCircle } from 'lucide-react';
import { useBookingDetail } from '@/hooks/useBookingDetail';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ADMIN_TRANSITIONS, ASSIGNABLE_STATUSES, CANCELLABLE_STATUSES, LIMITS, RESCHEDULABLE_STATUSES, SERIAL_COLUMN } from '@/constants/ui';
import { cn, formatDate, formatDateTime, formatMoney, humanize, mapsDirectionsUrl, serialNumber, toNumber } from '@/lib/utils';
import { Badge, ConfirmDialog, EmptyState, ErrorState, KeyValue, LoadingBlock, PageHeader, SectionCard, StatusBadge } from '@/components/common';
import { AssignDialog, AttachmentGallery, RescheduleDialog, StatusTimeline } from '@/components/BookingWidgets';
import { GenerateInvoiceDialog, RecordPaymentDialog } from '@/components/FinanceWidgets';
import { Button, Card, Textarea } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { useGoBack } from '@/hooks/useGoBack';

export default function BookingDetailPage() {
  const goBack = useGoBack(ROUTES.BOOKINGS);
  const id = Number(useParams().id);
  const d = useBookingDetail(id);
  const { can } = useAuth();
  const [note, setNote] = useState('');
  const b = d.booking.data;

  if (d.booking.isLoading) return <LoadingBlock rows={8} />;
  if (d.booking.error || !b) return <ErrorState message={(d.booking.error as Error)?.message} onRetry={() => d.booking.refetch()} />;

  const current = b.assignments.find((a) => a.isCurrent);
  const addr = b.addressSnapshot;
  const addrText = [addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  const transitions = ADMIN_TRANSITIONS[b.status] ?? [];
  const canEdit = can('bookings.edit');
  const balance = toNumber(d.activeInvoice?.balanceDue ?? b.estimatedTotal);

  return (
    <>
      <PageHeader onBack={goBack}
        title={b.bookingNumber}
        description={`${b.bookingType === 'REPAIR' ? 'Repair' : 'Service'} booking · created ${formatDateTime(b.createdAt)} · ${humanize(b.source)}`}
        breadcrumbs={[{ label: 'Bookings', to: ROUTES.BOOKINGS }, { label: b.bookingNumber }]}
        actions={
          <>
            <StatusBadge status={b.status} className="px-3 py-1 text-[12.5px]" />
            <Button variant="outline" onClick={() => d.actions.whatsapp.mutate('booking')} loading={d.actions.whatsapp.isPending}>
              <MessageCircle className="text-green-600" /> WhatsApp
            </Button>
            {canEdit && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <ArrowRightLeft /> Update status <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {transitions.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => d.openStatus(t)}>
                      {humanize(t)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {can('assignments.assign') && ASSIGNABLE_STATUSES.includes(b.status) && (
              <Button onClick={() => d.setDialog('assign')}>
                <HardHat /> {current ? 'Reassign' : 'Assign technician'}
              </Button>
            )}
            {can('invoices.create') && b.status === 'COMPLETED' && !d.activeInvoice && (
              <Button variant="secondary" onClick={() => d.setDialog('invoice')} disabled={!b.items.length}>
                <FileText /> Generate invoice
              </Button>
            )}
            {canEdit && (CANCELLABLE_STATUSES.includes(b.status) || RESCHEDULABLE_STATUSES.includes(b.status)) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {RESCHEDULABLE_STATUSES.includes(b.status) && (
                    <DropdownMenuItem onSelect={() => d.setDialog('reschedule')}>
                      <CalendarClock /> Reschedule
                    </DropdownMenuItem>
                  )}
                  {current && can('assignments.assign') && ['ASSIGNED', 'ACCEPTED'].includes(b.status) && (
                    <DropdownMenuItem onSelect={() => d.actions.unassign.mutate()}>
                      <UserMinus /> Unassign technician
                    </DropdownMenuItem>
                  )}
                  {current && (
                    <DropdownMenuItem onSelect={() => d.actions.whatsapp.mutate('assignment')}>
                      <Send /> Send job to technician (WhatsApp)
                    </DropdownMenuItem>
                  )}
                  {CANCELLABLE_STATUSES.includes(b.status) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => d.setDialog('cancel')}>
                        <XCircle /> Cancel booking
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <SectionCard title="Booking overview">
            <KeyValue
              columns={3}
              items={[
                { label: 'Customer', value: <Link className="text-brand-blue hover:underline" to={ROUTES.CUSTOMER_DETAIL(b.customer.id)}>{b.customer.fullName}</Link> },
                { label: 'Mobile', value: <a className="inline-flex items-center gap-1 hover:text-brand-blue" href={`tel:${b.customer.countryCode}${b.customer.mobile}`}><Phone className="h-3.5 w-3.5" />{b.customer.countryCode} {b.customer.mobile}</a> },
                { label: 'Customer ID', value: b.customer.customerCode },
                { label: 'Scheduled', value: `${formatDate(b.scheduledDate)}${b.scheduledTime ? ` · ${b.scheduledTime}` : ''}` },
                { label: 'Branch', value: b.branch.name },
                { label: 'Product', value: b.product?.name ?? '—' },
                { label: 'Payment', value: <Badge tone={b.paymentStatus === 'PAID' ? 'green' : 'amber'}>{humanize(b.paymentStatus)}</Badge> },
                { label: 'Estimated', value: <span className="num">{formatMoney(b.estimatedTotal)}</span> },
                { label: 'AMC', value: b.amcVisit ? <Link className="text-brand-blue hover:underline" to={ROUTES.AMC_DETAIL(b.amcVisit.amcContract.id)}>{b.amcVisit.amcContract.amcNumber} · visit {b.amcVisit.visitNumber}</Link> : '—' },
              ]}
            />
            {(b.problemCategory || b.problemDescription || b.instructions || b.cancelReason) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(b.problemCategory || b.problemDescription) && (
                  <div className="rounded-lg bg-amber-50 p-3.5 text-[13px]">
                    <p className="font-semibold text-amber-900">Problem{b.problemCategory ? ` · ${b.problemCategory}` : ''}</p>
                    <p className="mt-1 whitespace-pre-line text-amber-800">{b.problemDescription}</p>
                  </div>
                )}
                {b.instructions && (
                  <div className="rounded-lg bg-slate-50 p-3.5 text-[13px]">
                    <p className="font-semibold text-slate-700">Instructions</p>
                    <p className="mt-1 whitespace-pre-line text-slate-600">{b.instructions}</p>
                  </div>
                )}
                {b.cancelReason && (
                  <div className="rounded-lg bg-red-50 p-3.5 text-[13px]">
                    <p className="font-semibold text-red-800">Cancellation reason</p>
                    <p className="mt-1 text-red-700">{b.cancelReason}</p>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Services" bodyClassName="p-0">
            {b.items.length === 0 ? (
              <EmptyState title="No services yet" description="Repair bookings get services once diagnosed. Edit to add a quotation line." className="py-8" />
            ) : (
              <table className="w-full text-[13.5px]">
                <thead className="bg-slate-50 text-left text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className={cn('px-5 py-2.5', SERIAL_COLUMN.CLASS)}>{SERIAL_COLUMN.HEADER}</th>
                    <th className="px-5 py-2.5">Service</th>
                    <th className="px-5 py-2.5 text-right">Qty</th>
                    <th className="px-5 py-2.5 text-right">Rate</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {b.items.map((i, index) => (
                    <tr key={i.id}>
                      <td className={cn('px-5 py-3', SERIAL_COLUMN.CLASS, SERIAL_COLUMN.CELL_TEXT)}>{serialNumber(index)}</td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-brand-navy">{i.serviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.serviceCode} · {humanize(i.pricingType)} {i.isPerformed && <Badge tone="green" className="ml-1">Performed</Badge>}
                        </p>
                      </td>
                      <td className="num px-5 py-3 text-right">{i.quantity}</td>
                      <td className="num px-5 py-3 text-right">{formatMoney(i.unitPrice)}</td>
                      <td className="num px-5 py-3 text-right font-semibold">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard title="Job notes">
            <div className="space-y-4">
              {canEdit && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.NOTES_MAX} placeholder="Add an internal note…" className="min-h-[44px]" />
                  <Button className="sm:self-end" disabled={!note.trim()} loading={d.actions.addNote.isPending} onClick={() => d.actions.addNote.mutate(note.trim(), { onSuccess: () => setNote('') })}>
                    Add note
                  </Button>
                </div>
              )}
              {!b.notes?.length ? (
                <p className="text-[13px] text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {b.notes.map((n) => (
                    <li key={n.id} className="rounded-lg border bg-white p-3">
                      <p className="whitespace-pre-line text-[13.5px] text-slate-700">{n.note}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {n.author.name} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Photos & files">
            <AttachmentGallery items={b.attachments ?? []} onUpload={canEdit ? (files, kind) => d.actions.upload.mutate({ files, kind }) : undefined} uploading={d.actions.upload.isPending} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <MapPin className="h-4 w-4 text-brand-green-600" />
              <h3 className="font-display text-[15px] font-bold">Service location</h3>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-[13.5px] text-slate-700">{addrText}</p>
              {addr.latitude && addr.longitude ? (
                <Badge tone="green">Verified coordinates</Badge>
              ) : (
                <Badge tone="amber">No coordinates — navigation uses address search</Badge>
              )}
              <Button variant="soft" className="w-full" asChild>
                <a href={mapsDirectionsUrl(addr.latitude, addr.longitude, addrText)} target="_blank" rel="noreferrer">
                  <Navigation /> Open directions
                </a>
              </Button>
            </div>
          </Card>

          <SectionCard title="Technician">
            {current ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
                    <HardHat className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">{current.staff.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {current.staff.staffCode} · {current.staff.user.mobile}
                    </p>
                  </div>
                  <StatusBadge status={current.status} className="ml-auto" />
                </div>
                <p className="text-xs text-muted-foreground">Assigned {formatDateTime(current.assignedAt)}</p>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No technician assigned yet.</p>
            )}
            {b.assignments.some((a) => !a.isCurrent) && (
              <details className="mt-4 text-[12.5px]">
                <summary className="cursor-pointer font-semibold text-slate-600">Assignment history</summary>
                <ul className="mt-2 space-y-1.5">
                  {b.assignments
                    .filter((a) => !a.isCurrent)
                    .map((a) => (
                      <li key={a.id} className="flex justify-between gap-2 text-slate-600">
                        <span>{a.staff.user.name}</span>
                        <span>
                          {humanize(a.status)}
                          {a.rejectReason ? ` — ${a.rejectReason}` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </SectionCard>

          <SectionCard
            title="Billing"
            actions={
              can('payments.create') && !['CANCELLED', 'REJECTED'].includes(b.status) && b.paymentStatus !== 'PAID' ? (
                <Button size="sm" variant="soft" onClick={() => d.setDialog('payment')}>
                  <IndianRupee /> Record payment
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-3 text-[13px]">
              {b.invoices?.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Link to={ROUTES.INVOICE_DETAIL(inv.id)} className="font-semibold text-brand-blue hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(inv.grandTotal)} · balance {formatMoney(inv.balanceDue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={inv.status} />
                    <Button variant="ghost" size="icon-sm" aria-label="Download PDF" onClick={() => d.downloadInvoice(inv.id, inv.invoiceNumber)}>
                      <Download />
                    </Button>
                  </div>
                </div>
              ))}
              {!b.invoices?.length && <p className="text-muted-foreground">{b.status === 'COMPLETED' ? 'Ready to invoice.' : 'Invoice is generated after completion.'}</p>}
              {!!b.payments?.length && (
                <ul className="divide-y rounded-lg border">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-2">
                      <span>
                        <span className="num font-semibold">{formatMoney(p.amount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{humanize(p.method)}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Status timeline" actions={<ShieldCheck className="h-4 w-4 text-brand-green-600" />}>
            <StatusTimeline history={b.statusHistory ?? []} />
          </SectionCard>
        </div>
      </div>

      <AssignDialog open={d.dialog === 'assign'} onOpenChange={(o) => !o && d.close()} suggestions={d.suggestions.data} loading={d.suggestions.isLoading} submitting={d.actions.assign.isPending} onAssign={d.assign} bookingLabel={b.bookingNumber} />
      <RescheduleDialog open={d.dialog === 'reschedule'} onOpenChange={(o) => !o && d.close()} date={d.rescheduleDate} onDateChange={d.setRescheduleDate} slots={d.slots.data} slotsLoading={d.slots.isLoading} submitting={d.actions.reschedule.isPending} onSubmit={d.reschedule} />
      <ConfirmDialog open={d.dialog === 'cancel'} onOpenChange={(o) => !o && d.close()} title="Cancel booking?" description="The slot is released and any technician assignment is cancelled." confirmLabel="Cancel booking" destructive requireReason loading={d.actions.cancel.isPending} onConfirm={d.cancel} />
      <ConfirmDialog open={d.dialog === 'status'} onOpenChange={(o) => !o && d.close()} title={`Move to ${humanize(d.nextStatus)}?`} description="This change is recorded in the status history with your name." confirmLabel="Update status" loading={d.actions.changeStatus.isPending} onConfirm={d.changeStatus} />
      <GenerateInvoiceDialog
        open={d.dialog === 'invoice'}
        onOpenChange={(o) => !o && d.close()}
        options={d.invoiceOptions}
        onOptionsChange={d.setInvoiceOptions}
        totals={d.preview.data}
        lines={d.invoiceLines}
        submitting={d.generating}
        onSubmit={d.generateInvoice}
      />
      <RecordPaymentDialog open={d.dialog === 'payment'} onOpenChange={(o) => !o && d.close()} defaultAmount={balance} maxAmount={d.activeInvoice ? balance : undefined} context={`${b.bookingNumber} · ${b.customer.fullName}`} submitting={d.recording} onSubmit={d.recordPayment} />
    </>
  );
}
