/**
 * Invoice, payment, ledger and AMC logic for pages.
 */

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { amcService, invoiceService, paymentService } from '@/services/financeService';
import { settingsService } from '@/services/engagementService';
import { INVOICE_SHARE, MANUAL_PAYMENT } from '@/constants/ui';
import { downloadBlob, toNumber } from '@/lib/utils';
import type { PaymentForm } from '@/lib/validation';
import type { Customer, QueryParams, ShareLink } from '@/types';
import { errorMessage, useAction } from './useApi';
import { useCustomerSearch } from './usePeople';

const FIN_KEYS = [['invoices'], ['invoice'], ['payments'], ['ledger'], ['outstanding'], ['booking'], ['bookings'], ['amc'], ['dashboard'], ['finance'], ['stock-items']];

export const useInvoiceList = (params: QueryParams) =>
  useQuery({ queryKey: ['invoices', params], queryFn: () => invoiceService.list(params), placeholderData: keepPreviousData });
export const useInvoice = (id?: number) => useQuery({ queryKey: ['invoice', id], queryFn: () => invoiceService.get(id as number), enabled: !!id });
export const useInvoicePreview = (body: unknown, enabled: boolean) =>
  useQuery({ queryKey: ['invoice-preview', body], queryFn: () => invoiceService.preview(body), enabled, placeholderData: keepPreviousData });

export function useInvoiceActions() {
  return {
    fromBooking: useAction((body: unknown) => invoiceService.fromBooking(body), { success: (i) => `Invoice ${i.invoiceNumber} generated`, invalidate: FIN_KEYS }),
    createManual: useAction((body: unknown) => invoiceService.createManual(body), { success: (i) => `Invoice ${i.invoiceNumber} created`, invalidate: FIN_KEYS }),
    cancel: useAction((v: { id: number; reason: string }) => invoiceService.cancel(v.id, v.reason), { success: 'Invoice cancelled', invalidate: FIN_KEYS }),
    share: useAction((body: { invoiceIds: number[]; channel: 'EMAIL' | 'WHATSAPP'; toCustomer?: boolean; staffUserIds?: number[] }) => invoiceService.share(body), {
      onSuccess: (r, vars) => {
        if (vars.channel === 'WHATSAPP') {
          (r as Array<ShareLink>).forEach((l) => window.open(l.url, '_blank', 'noopener,noreferrer'));
        } else {
          const rows = r as Array<{ invoiceNumber: string; sentTo: string[]; error?: string }>;
          const ok = rows.filter((x) => !x.error).length;
          const failed = rows.filter((x) => x.error);
          if (ok) toast.success(`${ok} invoice(s) emailed`);
          failed.forEach((f) => toast.error(`${f.invoiceNumber}: ${f.error}`));
        }
      },
    }),
    downloadPdf: async (id: number, invoiceNumber: string, print = false) => {
      try {
        // Same PDF as download / email / WhatsApp (one generator on the server).
        const blob = await invoiceService.pdf(id);
        if (print) {
          // Print the PDF itself from a hidden frame (a "noopener" tab gives no handle to call print() on).
          const url = URL.createObjectURL(blob);
          const frame = document.createElement('iframe');
          frame.setAttribute('aria-hidden', 'true');
          frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
          frame.onload = () => {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            setTimeout(() => {
              URL.revokeObjectURL(url);
              frame.remove();
            }, INVOICE_SHARE.PRINT_CLEANUP_MS);
          };
          frame.src = url;
          document.body.appendChild(frame);
        } else downloadBlob(blob, `${invoiceNumber}.pdf`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    /**
     * WhatsApp share of one invoice — the PDF always goes along with the message:
     * - browsers that can share files (phones, Chrome/Edge on Windows with WhatsApp installed): the share
     *   sheet opens with the PDF attached + the message;
     * - otherwise: the PDF is downloaded and the customer's chat opens with the message (attach the file there).
     */
    whatsapp: useAction(async (v: { id: number; invoiceNumber: string }) => {
      // Fetch both at once so the share sheet still opens inside the click's user-activation window.
      const [links, blob] = await Promise.all([invoiceService.share({ invoiceIds: [v.id], channel: 'WHATSAPP' }) as Promise<ShareLink[]>, invoiceService.pdf(v.id)]);
      const [link] = links;
      const fileName = `${v.invoiceNumber}.pdf`;
      const file = new File([blob], fileName, { type: INVOICE_SHARE.PDF_MIME });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: link.message });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return; // user closed the share sheet
          // e.g. NotAllowedError — fall through to download + chat.
        }
      }
      downloadBlob(blob, fileName);
      window.open(link.url, '_blank', 'noopener,noreferrer');
      toast.info(INVOICE_SHARE.ATTACH_HINT(fileName));
    }),
    paymentReminder: useAction((id: number) => settingsService.whatsappLink('paymentReminder', id), { onSuccess: (r) => window.open(r.url, '_blank', 'noopener,noreferrer') }),
  };
}

export const usePaymentList = (params: QueryParams) =>
  useQuery({ queryKey: ['payments', params], queryFn: () => paymentService.list(params), placeholderData: keepPreviousData });

export function usePaymentActions() {
  return {
    record: useAction((v: { body: unknown; key: string }) => paymentService.record(v.body, v.key), { success: (p) => `Payment ${p.paymentNumber} recorded (${p.status.replace('_', ' ').toLowerCase()})`, invalidate: FIN_KEYS }),
    verify: useAction((v: { id: number; approve: boolean; note?: string }) => paymentService.verify(v.id, v.approve, v.note), { success: (p) => `Payment ${p.status === 'VERIFIED' ? 'approved' : 'rejected'}`, invalidate: FIN_KEYS }),
    refund: useAction((v: { id: number; amount: number; reason: string }) => paymentService.refund(v.id, v.amount, v.reason), { success: 'Refund recorded', invalidate: FIN_KEYS }),
    adjust: useAction((body: unknown) => paymentService.adjustLedger(body), { success: 'Ledger entry posted', invalidate: FIN_KEYS }),
  };
}

/**
 * Manual "Record payment" from the Payment In page: pick a customer, optionally one of their
 * unpaid invoices (amount defaults to and is capped at its balance), then record the payment.
 */
export function useManualPayment() {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [customerError, setCustomerError] = useState(false);
  const customers = useCustomerSearch(search);
  const invoices = useQuery({
    queryKey: ['invoices', 'outstanding-for', customer?.id],
    queryFn: () => invoiceService.list({ customerId: customer?.id, outstandingOnly: true, pageSize: MANUAL_PAYMENT.INVOICE_PAGE_SIZE }).then((p) => p.items),
    enabled: !!customer,
  });
  const { record } = usePaymentActions();
  const invoice = invoices.data?.find((i) => i.id === invoiceId) ?? null;
  const balance = invoice ? toNumber(invoice.balanceDue) : undefined;

  const setOpen = (o: boolean) => {
    setOpenState(o);
    if (o) {
      setSearch('');
      setCustomer(null);
      setInvoiceId(null);
      setCustomerError(false);
    }
  };
  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    setInvoiceId(null);
    setCustomerError(false);
  };
  const submit = (v: PaymentForm) => {
    if (!customer) {
      setCustomerError(true);
      return;
    }
    record.mutate(
      {
        key: crypto.randomUUID(),
        body: { customerId: customer.id, invoiceId: invoice?.id ?? null, method: v.method, amount: v.amount, referenceNumber: v.referenceNumber || null, receivedAt: v.receivedAt || undefined, note: v.note || null },
      },
      { onSuccess: () => setOpenState(false) },
    );
  };

  return {
    open,
    setOpen,
    search,
    setSearch,
    customer,
    selectCustomer,
    customerError,
    customers: customers.data ?? [],
    customersLoading: customers.isFetching,
    invoices: invoices.data ?? [],
    invoicesLoading: invoices.isFetching,
    invoiceId,
    setInvoiceId,
    balance,
    submitting: record.isPending,
    submit,
  };
}

export const useLedgerCustomers = (params: QueryParams) =>
  useQuery({ queryKey: ['ledger', 'customers', params], queryFn: () => paymentService.ledgerCustomers(params), placeholderData: keepPreviousData });

export const useOutstanding = (params: QueryParams) =>
  useQuery({ queryKey: ['outstanding', params], queryFn: () => paymentService.outstanding(params), placeholderData: keepPreviousData });
export const useFinanceSummary = (params: QueryParams) =>
  useQuery({ queryKey: ['finance', 'summary', params], queryFn: () => paymentService.summary(params), placeholderData: keepPreviousData });

export const useAmcList = (params: QueryParams) => useQuery({ queryKey: ['amc', params], queryFn: () => amcService.list(params), placeholderData: keepPreviousData });
export const useAmc = (id?: number) => useQuery({ queryKey: ['amc', 'one', id], queryFn: () => amcService.get(id as number), enabled: !!id });
export const useAmcVisits = (params: QueryParams) => useQuery({ queryKey: ['amc', 'visits', params], queryFn: () => amcService.visits(params), placeholderData: keepPreviousData });

export function useAmcActions() {
  return {
    create: useAction((body: unknown) => amcService.create(body), { success: (a) => `AMC ${a.amcNumber} created`, invalidate: FIN_KEYS }),
    update: useAction((v: { id: number; body: unknown }) => amcService.update(v.id, v.body), { success: 'AMC updated', invalidate: FIN_KEYS }),
    issueInvoice: useAction((id: number) => amcService.issueInvoice(id), { success: 'AMC invoice issued', invalidate: FIN_KEYS }),
    activate: useAction((id: number) => amcService.activate(id), { success: 'AMC activated & visits scheduled', invalidate: FIN_KEYS }),
    cancel: useAction((v: { id: number; reason: string }) => amcService.cancel(v.id, v.reason), { success: 'AMC cancelled', invalidate: FIN_KEYS }),
    bookVisit: useAction((v: { id: number; scheduledDate: string; slotId?: number | null; staffId?: number | null }) => amcService.bookVisit(v.id, v), { success: 'Visit booked', invalidate: FIN_KEYS }),
  };
}
