/**
 * Invoices, payments, ledger and AMC API calls.
 */

import { API, HTTP } from '@/constants/api';
import type { AmcContract, AmcVisit, FinanceSummary, Invoice, InvoiceTotals, Payment, QueryParams, ShareLink } from '@/types';
import { http } from './apiClient';

export const invoiceService = {
  list: (params?: QueryParams) => http.page<Invoice>(API.INVOICES, params),
  get: (id: number) => http.get<Invoice>(API.INVOICE(id)),
  preview: (body: unknown) => http.post<InvoiceTotals>(API.INVOICE_PREVIEW, body),
  fromBooking: (body: unknown) => http.post<Invoice>(API.INVOICE_FROM_BOOKING, body),
  createManual: (body: unknown) => http.post<Invoice>(API.INVOICES, body),
  cancel: (id: number, reason: string) => http.post<Invoice>(API.INVOICE_CANCEL(id), { reason }),
  pdf: (id: number) => http.blob(API.INVOICE_PDF(id)),
  share: (body: { invoiceIds: number[]; channel: 'EMAIL' | 'WHATSAPP'; toCustomer?: boolean; staffUserIds?: number[] }) =>
    http.post<Array<ShareLink & { invoiceId: number }> | Array<{ invoiceId: number; invoiceNumber: string; sentTo: string[]; error?: string }>>(API.INVOICE_SHARE, body),
};

export const paymentService = {
  list: (params?: QueryParams) => http.page<Payment>(API.PAYMENTS, params),
  record: (body: unknown, idempotencyKey: string) => http.post<Payment>(API.PAYMENTS, body, { [HTTP.IDEMPOTENCY_HEADER]: idempotencyKey }),
  verify: (id: number, approve: boolean, note?: string) => http.post<Payment>(API.PAYMENT_VERIFY(id), { approve, note }),
  refund: (id: number, amount: number, reason: string) => http.post<Payment>(API.PAYMENT_REFUND(id), { amount, reason }),
  adjustLedger: (body: unknown) => http.post(API.LEDGER_ADJUST, body),
  outstanding: (params?: QueryParams) =>
    http.page<{ customerId: number; customerCode: string; fullName: string; mobile: string; balance: number; lastEntry: string }>(API.OUTSTANDING, params),
  summary: (params?: QueryParams) => http.get<FinanceSummary>(API.FINANCE_SUMMARY, params),
};

export const amcService = {
  list: (params?: QueryParams) => http.page<AmcContract>(API.AMC, params),
  get: (id: number) => http.get<AmcContract>(API.AMC_ONE(id)),
  create: (body: unknown) => http.post<AmcContract>(API.AMC, body),
  update: (id: number, body: unknown) => http.patch<AmcContract>(API.AMC_ONE(id), body),
  issueInvoice: (id: number) => http.post<AmcContract>(API.AMC_INVOICE(id)),
  activate: (id: number) => http.post<AmcContract>(API.AMC_ACTIVATE(id)),
  cancel: (id: number, reason: string) => http.post<AmcContract>(API.AMC_CANCEL(id), { reason }),
  visits: (params?: QueryParams) => http.page<AmcVisit>(API.AMC_VISITS, params),
  bookVisit: (id: number, body: { scheduledDate: string; slotId?: number | null; staffId?: number | null }) => http.post<AmcVisit>(API.AMC_VISIT_BOOK(id), body),
};
