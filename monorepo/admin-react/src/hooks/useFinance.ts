/**
 * Invoice, payment, ledger and AMC logic for pages.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { amcService, invoiceService, paymentService } from '@/services/financeService';
import { settingsService } from '@/services/engagementService';
import { downloadBlob } from '@/lib/utils';
import type { QueryParams, ShareLink } from '@/types';
import { errorMessage, useAction } from './useApi';

const FIN_KEYS = [['invoices'], ['invoice'], ['payments'], ['ledger'], ['outstanding'], ['booking'], ['bookings'], ['amc'], ['dashboard'], ['finance']];

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
        const blob = await invoiceService.pdf(id);
        if (print) {
          const url = URL.createObjectURL(blob);
          const w = window.open(url, '_blank', 'noopener');
          if (w) w.addEventListener('load', () => w.print());
        } else downloadBlob(blob, `${invoiceNumber}.pdf`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
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
