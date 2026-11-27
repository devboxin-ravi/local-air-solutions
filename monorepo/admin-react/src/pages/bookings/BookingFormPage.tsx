/**
 * Create a service or repair booking (admin). Composition only — logic in useBookingForm.
 */

import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CalendarDays, MapPin, Minus, Plus, Trash2, UserPlus, Wrench, Snowflake } from 'lucide-react';
import { useBookingForm } from '@/hooks/useBookingForm';
import { useBranches, useProducts } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import { cn, formatMoney, toYmd } from '@/lib/utils';
import { LIMITS, PLACEHOLDERS } from '@/constants/ui';
import { Badge, Field, FormCard, FormSection, PageHeader } from '@/components/common';
import { CustomerPicker, SearchSelect, SlotGrid } from '@/components/Pickers';
import { Button, Card, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { useGoBack } from '@/hooks/useGoBack';

export default function BookingFormPage() {
  const goBack = useGoBack(ROUTES.BOOKINGS);
  const [params] = useSearchParams();
  const f = useBookingForm(params.get('customerId') ? Number(params.get('customerId')) : undefined);
  const { state: s, set } = f;
  const { data: branches } = useBranches({ activeOnly: true });
  const { data: products } = useProducts();
  const availableServices = (f.services.data ?? []).filter((x) => !s.lines.some((l) => l.serviceId === x.id));

  return (
    <>
      <PageHeader onBack={goBack} title="New Booking" description="Create a service or repair booking on behalf of a customer." breadcrumbs={[{ label: 'Bookings', to: ROUTES.BOOKINGS }, { label: 'New Booking' }]} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <FormCard>
          <FormSection step={1} title="Booking type" description="A routine service visit or a repair job.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    v: 'SERVICE',
                    icon: Snowflake,
                    title: 'Service',
                    text: 'Installation, servicing, cleaning…',
                  },
                  {
                    v: 'REPAIR',
                    icon: Wrench,
                    title: 'Repairing',
                    text: 'Diagnose and fix a problem',
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set.setBookingType(o.v)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all duration-micro',
                    s.bookingType === o.v ? 'border-brand-blue ring-2 ring-brand-blue/20' : 'hover:border-brand-blue-300',
                  )}
                >
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', s.bookingType === o.v ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500')}>
                    <o.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display font-bold text-brand-navy">{o.title}</span>
                    <span className="block text-xs text-muted-foreground">{o.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Customer & location"
            description="Who the booking is for and which address to visit."
            actions={
              <Button variant="soft" size="sm" asChild>
                <Link to={ROUTES.CUSTOMER_NEW}>
                  <UserPlus /> New customer
                </Link>
              </Button>
            }
          >
            <div className="space-y-4">
              <Field label="Customer" required error={s.errors.customerId}>
                <CustomerPicker
                  value={s.customer}
                  options={f.customerSearch.data ?? []}
                  loading={f.customerSearch.isFetching}
                  search={s.search}
                  onSearchChange={set.setSearch}
                  onSelect={f.selectCustomer}
                  invalid={!!s.errors.customerId}
                />
              </Field>
              {s.customer && (
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <Field label="Service address" required error={s.errors.addressId}>
                    {s.addresses.length ? (
                      <div className="space-y-2">
                        {s.addresses.map((a) => (
                          <label
                            key={a.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                              s.address?.id === a.id ? 'border-brand-blue bg-brand-blue-50/50' : 'hover:bg-slate-50',
                            )}
                          >
                            <input type="radio" name="address" className="mt-1 accent-[#0048A8]" checked={s.address?.id === a.id} onChange={() => set.setAddressId(a.id)} />
                            <span className="text-[13px]">
                              <span className="flex items-center gap-2 font-semibold text-brand-navy">
                                <MapPin className="h-3.5 w-3.5 text-brand-green-600" /> {a.label}
                                {a.isDefault && <Badge tone="green">Default</Badge>}
                              </span>
                              <span className="mt-0.5 block text-slate-600">{[a.line1, a.line2, a.landmark, a.city?.name, a.pincode].filter(Boolean).join(', ')}</span>
                              {a.serviceArea && <span className="mt-0.5 block text-xs text-muted-foreground">Service area: {a.serviceArea.name}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">
                        No address on file.{' '}
                        <Link className="font-semibold text-brand-blue" to={ROUTES.CUSTOMER_DETAIL(s.customer.id)}>
                          Add one
                        </Link>{' '}
                        first.
                      </p>
                    )}
                  </Field>
                  <Field label="Branch" required error={s.errors.branchId} hint={s.address?.serviceArea ? 'Auto-selected from service area' : undefined}>
                    <NativeSelect searchable value={s.branchId ?? ''} onChange={(e) => set.setBranchOverride(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Select branch</option>
                      {branches?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            step={3}
            title={s.bookingType === 'REPAIR' ? 'Problem details' : 'Services'}
            description={s.bookingType === 'REPAIR' ? 'What is wrong, and any services already known.' : 'What the technician will do. Add as many as needed.'}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Product type">
                  <NativeSelect searchable value={s.productId ?? ''} onChange={(e) => set.setProductId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select product</option>
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {s.bookingType === 'REPAIR' && (
                  <Field label="Problem category">
                    <Input value={s.problemCategory} onChange={(e) => set.setProblemCategory(e.target.value)} maxLength={100} placeholder="e.g. Not cooling, water leakage" />
                  </Field>
                )}
              </div>
              {s.bookingType === 'REPAIR' && (
                <Field
                  label="Problem description"
                  required
                  error={s.errors.problemDescription}
                  counter={{
                    value: s.problemDescription.length,
                    max: LIMITS.DESCRIPTION_MAX,
                  }}
                >
                  <Textarea
                    value={s.problemDescription}
                    onChange={(e) => set.setProblemDescription(e.target.value)}
                    maxLength={LIMITS.DESCRIPTION_MAX}
                    placeholder="What is the customer experiencing?"
                  />
                </Field>
              )}
              <Field label={s.bookingType === 'REPAIR' ? 'Services (optional — add once diagnosed)' : 'Add services'} required={s.bookingType === 'SERVICE'} error={s.errors.items}>
                <SearchSelect
                  id="booking-add-service"
                  resetOnSelect
                  placeholder="Search and add a service…"
                  emptyText="No services match"
                  loading={f.services.isLoading}
                  disabled={!s.branchId && !f.services.data}
                  options={availableServices.map((x) => ({
                    value: x.id,
                    label: x.name,
                    hint: [x.code, x.category?.name].filter(Boolean).join(' · ') || undefined,
                    meta: x.pricingType === 'QUOTATION' ? 'Quotation' : x.pricingType === 'FREE' ? 'Free' : formatMoney(x.effectivePrice),
                  }))}
                  onChange={(id) => id && f.addLine(id)}
                />
              </Field>
              {s.lines.length > 0 && (
                <ul className="divide-y rounded-xl border">
                  {s.lines.map((l) => {
                    const p = f.pricingOf(l.serviceId);
                    return (
                      <li key={l.serviceId} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-brand-navy">{p?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p?.type === 'QUOTATION' ? 'Price on inspection' : p?.type === 'FREE' ? 'Free service' : `${p?.type === 'STARTING' ? 'From ' : ''}${formatMoney(p?.price)}`}
                          </p>
                        </div>
                        <div className="flex items-center rounded-lg border">
                          <button type="button" className="p-2 text-slate-500 hover:text-brand-blue" onClick={() => f.setQty(l.serviceId, l.quantity - 1)} aria-label="Decrease quantity">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="num w-8 text-center text-sm font-semibold">{l.quantity}</span>
                          <button type="button" className="p-2 text-slate-500 hover:text-brand-blue" onClick={() => f.setQty(l.serviceId, l.quantity + 1)} aria-label="Increase quantity">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => f.removeLine(l.serviceId)} aria-label="Remove service">
                          <Trash2 className="text-red-500" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </FormSection>

          <FormSection step={4} title="Schedule" description="Preferred visit date, time slot and notes for the technician.">
            <div className="space-y-4">
              <Field label="Preferred date" required error={s.errors.scheduledDate} className="max-w-xs">
                <Input type="date" value={s.scheduledDate} min={toYmd(new Date())} onChange={(e) => set.setScheduledDate(e.target.value)} />
              </Field>
              <Field label="Time slot" hint={s.branchId ? undefined : 'Select a customer/branch to see slots'}>
                {s.branchId ? <SlotGrid slots={f.slots.data} loading={f.slots.isLoading} value={s.slotId} onChange={set.setSlotId} /> : null}
              </Field>
              <Field
                label="Additional instructions"
                counter={{
                  value: s.instructions.length,
                  max: LIMITS.NOTES_MAX,
                }}
              >
                <Textarea value={s.instructions} onChange={(e) => set.setInstructions(e.target.value)} maxLength={LIMITS.NOTES_MAX} placeholder={PLACEHOLDERS.BOOKING_INSTRUCTIONS} />
              </Field>
            </div>
          </FormSection>
        </FormCard>

        {/* Summary */}
        <div className="xl:sticky xl:top-[97px] xl:self-start">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-blue to-brand-blue-500 px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">Booking summary</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{formatMoney(f.estimate.total)}</p>
              <p className="text-xs text-blue-100">
                Estimated (before GST)
                {f.estimate.quoteItems ? ` + ${f.estimate.quoteItems} quotation item(s)` : ''}
              </p>
            </div>
            <div className="space-y-3 p-5 text-[13px]">
              <Row label="Type" value={s.bookingType === 'REPAIR' ? 'Repairing' : 'Service'} />
              <Row label="Customer" value={s.customer?.fullName ?? '—'} />
              <Row label="Branch" value={branches?.find((b) => b.id === s.branchId)?.name ?? '—'} />
              <Row label="Services" value={s.lines.length ? `${s.lines.length} selected` : '—'} />
              <Row
                label="Date"
                value={
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> {s.scheduledDate}
                  </span>
                }
              />
              <Row
                label="Slot"
                value={
                  f.slots.data?.find((x) => x.id === s.slotId) ? `${f.slots.data.find((x) => x.id === s.slotId)!.startTime}–${f.slots.data.find((x) => x.id === s.slotId)!.endTime}` : 'Not selected'
                }
              />
              {s.formError && (
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s.formError}
                </p>
              )}
              <Button className="mt-2 w-full" size="lg" loading={f.submitting} onClick={f.submit}>
                Create booking
              </Button>
              <p className="text-center text-[11.5px] text-muted-foreground">Prices are locked on the booking at creation.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right font-semibold text-brand-navy">{value}</span>
  </div>
);
