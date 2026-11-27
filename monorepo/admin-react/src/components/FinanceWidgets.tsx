/**
 * Finance UI: record-payment dialog, invoice-generation dialog (GST toggle + live totals),
 * totals summary block. UI only.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn, formatMoney, toYmd } from '@/lib/utils';
import { PAYMENT_METHODS, PLACEHOLDERS } from '@/constants/ui';
import { paymentSchema, type PaymentForm } from '@/lib/validation';
import type { InvoiceTotals } from '@/types';
import { Field } from './common';
import { Button, Checkbox, Input, Label, NativeSelect, Textarea } from './ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/overlays';

export const RecordPaymentDialog = ({
  open,
  onOpenChange,
  maxAmount,
  defaultAmount,
  context,
  submitting,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  maxAmount?: number;
  defaultAmount?: number;
  context: string;
  submitting?: boolean;
  onSubmit: (v: PaymentForm) => void;
  /** Extra fields rendered above the payment fields (e.g. customer / invoice pickers). */
  children?: React.ReactNode;
}) => {
  const form = useForm<PaymentForm>({ resolver: zodResolver(paymentSchema), defaultValues: { method: 'UPI_MANUAL', amount: defaultAmount ?? 0, referenceNumber: '', receivedAt: toYmd(new Date()), note: '' } });
  // Reset the whole form only when the dialog opens (defaultAmount deliberately not a dependency)…
  React.useEffect(() => {
    if (open) form.reset({ method: 'UPI_MANUAL', amount: defaultAmount ?? 0, referenceNumber: '', receivedAt: toYmd(new Date()), note: '' });
  }, [open, form]);
  // …and only the amount when the suggested amount changes (e.g. another invoice picked), keeping typed fields.
  React.useEffect(() => {
    if (open) form.setValue('amount', defaultAmount ?? 0);
  }, [open, defaultAmount, form]);
  const method = form.watch('method');
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Record payment" description={context} />
        <form
          onSubmit={form.handleSubmit((v) => {
            if (maxAmount !== undefined && v.amount > maxAmount + 0.001) {
              form.setError('amount', { message: `Cannot exceed balance ${formatMoney(maxAmount)}` });
              return;
            }
            onSubmit(v);
          })}
          noValidate
        >
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {children && <div className="grid gap-4 sm:col-span-2">{children}</div>}
            <Field label="Method" required>
              <NativeSelect {...form.register('method')}>
                {PAYMENT_METHODS.filter((m) => m.value !== 'RAZORPAY').map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Amount (₹)" required error={e.amount?.message} hint={maxAmount !== undefined ? `Balance: ${formatMoney(maxAmount)}` : undefined}>
              <Input type="number" step="0.01" min="0" inputMode="decimal" {...form.register('amount')} placeholder={PLACEHOLDERS.AMOUNT} aria-invalid={!!e.amount} />
            </Field>
            <Field label={method === 'CASH' ? 'Receipt no. (optional)' : 'Transaction / UTR reference'} required={method !== 'CASH'} error={e.referenceNumber?.message}>
              <Input {...form.register('referenceNumber')} placeholder={method === 'CASH' ? PLACEHOLDERS.RECEIPT_NO : PLACEHOLDERS.PAYMENT_REFERENCE} maxLength={100} aria-invalid={!!e.referenceNumber} />
            </Field>
            <Field label="Received on">
              <Input type="date" max={toYmd(new Date())} {...form.register('receivedAt')} />
            </Field>
            <Field label="Note" className="sm:col-span-2" error={e.note?.message}>
              <Textarea {...form.register('note')} placeholder={PLACEHOLDERS.NOTE} maxLength={1000} className="min-h-[64px]" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const TotalsSummary = ({ totals, applyGst, isInterState, className }: { totals?: InvoiceTotals; applyGst: boolean; isInterState: boolean; className?: string }) => (
  <dl className={cn('space-y-2 text-[13.5px]', className)}>
    <Row label="Subtotal" value={formatMoney(totals?.subtotal)} />
    {!!totals?.discount && <Row label="Discount" value={`− ${formatMoney(totals.discount)}`} />}
    <Row label="Taxable amount" value={formatMoney(totals?.taxableAmount)} />
    {applyGst &&
      (isInterState ? (
        <Row label="IGST" value={formatMoney(totals?.igst)} />
      ) : (
        <>
          <Row label="CGST" value={formatMoney(totals?.cgst)} />
          <Row label="SGST" value={formatMoney(totals?.sgst)} />
        </>
      ))}
    <div className="flex items-center justify-between border-t pt-2.5">
      <dt className="font-display font-bold text-brand-navy">Grand total</dt>
      <dd className="num font-display text-lg font-extrabold text-brand-blue">{formatMoney(totals?.grandTotal)}</dd>
    </div>
  </dl>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="num font-semibold text-slate-700">{value}</dd>
  </div>
);

export interface InvoiceOptionsValue {
  applyGst: boolean;
  isInterState: boolean;
  discount: number;
  isFreeService: boolean;
  notes: string;
}

export const InvoiceOptions = ({ value, onChange }: { value: InvoiceOptionsValue; onChange: (v: InvoiceOptionsValue) => void }) => (
  <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {([
        ['applyGst', 'Apply GST', 'Add configured GST'],
        ['isInterState', 'Inter-state', 'Use IGST instead of CGST+SGST'],
        ['isFreeService', 'Free service', '100% discount, value retained'],
      ] as const).map(([k, label, hint]) => (
        <label key={k} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border p-3', value[k] && 'border-brand-blue bg-brand-blue-50/50', k === 'isInterState' && !value.applyGst && 'pointer-events-none opacity-50')}>
          <Checkbox checked={value[k]} onCheckedChange={(c) => onChange({ ...value, [k]: !!c })} className="mt-0.5" />
          <span>
            <Label className="cursor-pointer font-semibold text-brand-navy">{label}</Label>
            <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
          </span>
        </label>
      ))}
    </div>
    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
      <Field label="Discount (₹)">
        <Input type="number" min="0" step="0.01" value={value.discount} placeholder={PLACEHOLDERS.AMOUNT} disabled={value.isFreeService} onChange={(e) => onChange({ ...value, discount: Math.max(0, Number(e.target.value) || 0) })} />
      </Field>
      <Field label="Invoice notes" counter={{ value: value.notes.length, max: 1000 }}>
        <Input value={value.notes} placeholder={PLACEHOLDERS.INVOICE_NOTES} maxLength={1000} onChange={(e) => onChange({ ...value, notes: e.target.value })} />
      </Field>
    </div>
  </div>
);

export const GenerateInvoiceDialog = ({
  open,
  onOpenChange,
  options,
  onOptionsChange,
  totals,
  lines,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: InvoiceOptionsValue;
  onOptionsChange: (v: InvoiceOptionsValue) => void;
  totals?: InvoiceTotals;
  lines: Array<{ description: string; quantity: number; rate: number }>;
  submitting?: boolean;
  onSubmit: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="lg">
      <DialogHeader title="Generate invoice" description="Line items are taken from the booking’s locked prices." />
      <DialogBody className="space-y-5">
        <ul className="divide-y rounded-xl border text-[13px]">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="truncate font-medium text-brand-navy">{l.description}</span>
              <span className="num shrink-0 text-slate-600">
                {l.quantity} × {formatMoney(l.rate)}
              </span>
            </li>
          ))}
        </ul>
        <InvoiceOptions value={options} onChange={onOptionsChange} />
        <div className="rounded-xl bg-slate-50 p-4">
          <TotalsSummary totals={totals} applyGst={options.applyGst} isInterState={options.isInterState} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button loading={submitting} onClick={onSubmit}>
          Generate invoice
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
