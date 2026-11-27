/**
 * Invoices, payments, ledger and AMC controllers — HTTP only.
 */

import { Request } from 'express';
import { services } from '../dependencies/dependencies';
import { HeaderNames, perm } from '../constants';
import type { UploadedFileInfo } from '../models';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendOk, sendPage } from '../utils/http';

const idempotencyKey = (req: Request) => req.get(HeaderNames.IDEMPOTENCY_KEY)?.slice(0, 100);

// ─── Invoices ───
export const listInvoices = asyncHandler(async (req, res) => {
  sendPage(res, await services().invoices.list(actorOf(req), req.query as never));
});
export const getInvoice = asyncHandler(async (req, res) => {
  sendOk(res, await services().invoices.get(actorOf(req), idParam(req)));
});
export const previewInvoice = asyncHandler(async (req, res) => {
  sendOk(res, services().invoices.preview(req.body.lines, req.body));
});
export const createInvoiceFromBooking = asyncHandler(async (req, res) => {
  sendCreated(res, await services().invoices.createFromBooking(actorOf(req), req.body, metaOf(req)));
});
export const createManualInvoice = asyncHandler(async (req, res) => {
  sendCreated(res, await services().invoices.createManual(actorOf(req), req.body, metaOf(req)));
});
export const cancelInvoice = asyncHandler(async (req, res) => {
  sendOk(res, await services().invoices.cancel(actorOf(req), idParam(req), req.body.reason, metaOf(req)));
});
export const invoicePdf = asyncHandler(async (req, res) => {
  const inv = await services().invoices.get(actorOf(req), idParam(req));
  const pdf = await services().documents.invoicePdf(inv);
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${inv.invoiceNumber}.pdf"`);
  res.send(pdf);
});
/** Public (no login) invoice PDF behind a signed, expiring token — the link sent on WhatsApp. */
export const publicInvoicePdf = asyncHandler(async (req, res) => {
  const { invoiceNumber, pdf } = await services().share.publicInvoicePdf(String(req.params.token));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoiceNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.send(pdf);
});
export const shareInvoices = asyncHandler(async (req, res) => {
  const { invoiceIds, channel, toCustomer, staffUserIds } = req.body;
  if (channel === 'WHATSAPP') sendOk(res, await services().share.whatsappInvoices(actorOf(req), invoiceIds));
  else sendOk(res, await services().share.emailInvoices(actorOf(req), invoiceIds, toCustomer, staffUserIds));
});

// ─── Payments ───
export const listPayments = asyncHandler(async (req, res) => {
  sendPage(res, await services().payments.list(actorOf(req), req.query as never));
});
export const getPayment = asyncHandler(async (req, res) => {
  sendOk(res, await services().payments.get(actorOf(req), idParam(req)));
});
export const recordPayment = asyncHandler(async (req, res) => {
  const actor = actorOf(req);
  // Users holding payments.approve record cash/bank payments as verified immediately.
  const canApprove = actor.isSuperAdmin || actor.permissions.includes(perm('payments', 'approve'));
  sendCreated(res, await services().payments.record(actor, req.body, canApprove, idempotencyKey(req), metaOf(req)));
});
export const verifyPayment = asyncHandler(async (req, res) => {
  sendOk(res, await services().payments.verify(actorOf(req), idParam(req), req.body.approve, req.body.note, metaOf(req)));
});
export const refundPayment = asyncHandler(async (req, res) => {
  sendOk(res, await services().payments.refund(actorOf(req), idParam(req), req.body.amount, req.body.reason, metaOf(req)));
});
export const submitUpiPayment = asyncHandler(async (req, res) => {
  const saved = (res.locals.files as UploadedFileInfo[] | undefined) ?? [];
  const body = {
    bookingId: req.body.bookingId ? Number(req.body.bookingId) : null,
    invoiceId: req.body.invoiceId ? Number(req.body.invoiceId) : null,
    amcContractId: req.body.amcContractId ? Number(req.body.amcContractId) : null,
    amount: Number(req.body.amount),
    referenceNumber: req.body.referenceNumber,
  };
  sendCreated(res, await services().payments.submitUpi(actorOf(req), body, saved[0]?.path ?? null, idempotencyKey(req)));
});
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  sendCreated(res, await services().payments.createRazorpayOrder(actorOf(req), req.body));
});
export const verifyRazorpay = asyncHandler(async (req, res) => {
  sendOk(res, await services().payments.verifyRazorpayCheckout(actorOf(req), req.body));
});
export const razorpayWebhook = asyncHandler(async (req, res) => {
  sendOk(res, await services().payments.handleRazorpayWebhook(req.rawBody, req.get(HeaderNames.RAZORPAY_SIGNATURE)));
});

// ─── Ledger ───
export const ledgerAdjust = asyncHandler(async (req, res) => {
  sendCreated(res, await services().ledger.adjust(actorOf(req), req.body, metaOf(req)));
});
export const ledgerCustomers = asyncHandler(async (req, res) => {
  sendPage(res, await services().ledger.customerBalances(actorOf(req), req.query as never));
});
export const outstanding = asyncHandler(async (req, res) => {
  sendPage(res, await services().ledger.outstanding(actorOf(req), req.query as never));
});
export const financeSummary = asyncHandler(async (req, res) => {
  sendOk(res, await services().reports.financeSummary(actorOf(req), req.query as never));
});

// ─── AMC ───
export const listAmc = asyncHandler(async (req, res) => {
  sendPage(res, await services().amc.list(actorOf(req), req.query as never));
});
export const getAmc = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.get(actorOf(req), idParam(req)));
});
export const createAmc = asyncHandler(async (req, res) => {
  sendCreated(res, await services().amc.create(actorOf(req), req.body, metaOf(req)));
});
export const updateAmc = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.update(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const issueAmcInvoice = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.issueInvoice(actorOf(req), idParam(req), metaOf(req)));
});
export const activateAmc = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.activate(actorOf(req), idParam(req), metaOf(req)));
});
export const cancelAmc = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.cancel(actorOf(req), idParam(req), req.body.reason, metaOf(req)));
});
export const listAmcVisits = asyncHandler(async (req, res) => {
  sendPage(res, await services().amc.listVisits(actorOf(req), req.query as never));
});
export const bookAmcVisit = asyncHandler(async (req, res) => {
  sendOk(res, await services().amc.bookVisit(actorOf(req), idParam(req), req.body, metaOf(req)));
});
