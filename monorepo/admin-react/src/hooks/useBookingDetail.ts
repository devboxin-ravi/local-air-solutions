/**
 * Booking detail page logic: data, dialogs state, assignment suggestions, reschedule slots,
 * invoice generation (with live GST preview) and payment recording.
 */

import { useMemo, useState } from 'react';
import { toYmd, toNumber } from '@/lib/utils';
import type { InvoiceOptionsValue } from '@/components/FinanceWidgets';
import type { PaymentForm } from '@/lib/validation';
import type { AssignInput } from '@/types';
import { useAvailableSlots, useBooking, useBookingActions, useSuggestions } from './useOperations';
import { useInvoiceActions, useInvoicePreview, usePaymentActions } from './useFinance';
import { useInvoiceParts } from './useStock';

export type BookingDialog = 'assign' | 'reschedule' | 'cancel' | 'invoice' | 'payment' | 'status' | null;

export function useBookingDetail(id: number) {
  const booking = useBooking(id);
  const actions = useBookingActions(id);
  const invoices = useInvoiceActions();
  const payments = usePaymentActions();
  const [dialog, setDialog] = useState<BookingDialog>(null);
  const [nextStatus, setNextStatus] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState(toYmd(new Date(Date.now() + 86_400_000)));
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOptionsValue>({ applyGst: true, isInterState: false, discount: 0, isFreeService: false, notes: '' });

  const b = booking.data;
  const suggestions = useSuggestions(dialog === 'assign' ? id : undefined);
  const slots = useAvailableSlots(dialog === 'reschedule' ? b?.branchId : undefined, rescheduleDate);

  const parts = useInvoiceParts(dialog === 'invoice' ? b?.branchId : undefined);
  const serviceLines = useMemo(
    () => (b?.items ?? []).map((i) => ({ serviceId: i.serviceId, description: i.serviceName, quantity: i.quantity, rate: toNumber(i.unitPrice), gstRate: toNumber(i.gstRate), discount: 0 })),
    [b?.items],
  );
  const invoiceLines = useMemo(() => [...serviceLines, ...parts.lines], [serviceLines, parts.lines]);
  const previewBody = useMemo(() => ({ lines: invoiceLines, ...invoiceOptions }), [invoiceLines, invoiceOptions]);
  const preview = useInvoicePreview(previewBody, dialog === 'invoice' && invoiceLines.length > 0);

  // Payments go against the approved invoice; a bill still in For Invoice is not payable.
  const activeInvoice = b?.invoices?.find((i) => i.status !== 'DRAFT');
  const pendingBill = b?.invoices?.find((i) => i.status === 'DRAFT');
  const close = () => setDialog(null);

  return {
    booking,
    dialog,
    setDialog,
    close,
    nextStatus,
    openStatus: (s: string) => {
      setNextStatus(s);
      setDialog('status');
    },
    suggestions,
    slots,
    rescheduleDate,
    setRescheduleDate,
    invoiceOptions,
    setInvoiceOptions,
    invoiceLines,
    parts,
    preview,
    activeInvoice,
    pendingBill,
    actions,
    changeStatus: (note: string) => actions.changeStatus.mutate({ status: nextStatus, note: note || undefined }, { onSuccess: close }),
    assign: (input: AssignInput) => actions.assign.mutate(input, { onSuccess: close }),
    reschedule: (v: { scheduledDate: string; slotId: number | null; note: string }) => actions.reschedule.mutate({ ...v, note: v.note || undefined }, { onSuccess: close }),
    cancel: (reason: string) => actions.cancel.mutate(reason, { onSuccess: close }),
    generateInvoice: () =>
      invoices.fromBooking.mutate(
        { bookingId: id, applyGst: invoiceOptions.applyGst, isInterState: invoiceOptions.isInterState, discount: invoiceOptions.discount, isFreeService: invoiceOptions.isFreeService, notes: invoiceOptions.notes || null, ...(parts.lines.length ? { lines: invoiceLines } : {}) },
        {
          onSuccess: () => {
            parts.reset();
            close();
          },
        },
      ),
    generating: invoices.fromBooking.isPending,
    recordPayment: (v: PaymentForm) =>
      b &&
      payments.record.mutate(
        {
          key: crypto.randomUUID(),
          body: { customerId: b.customerId, bookingId: b.id, invoiceId: activeInvoice?.id ?? null, method: v.method, account: v.account, receivedBy: v.receivedBy, amount: v.amount, referenceNumber: v.referenceNumber || null, receivedAt: v.receivedAt || undefined, note: v.note || null },
        },
        { onSuccess: close },
      ),
    recording: payments.record.isPending,
    downloadInvoice: invoices.downloadPdf,
  };
}
