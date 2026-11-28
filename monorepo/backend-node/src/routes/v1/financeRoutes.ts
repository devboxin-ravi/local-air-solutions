/**
 * Invoices, payments, ledger, AMC, reminders, notifications, settings, reports — route definitions only.
 */

import { Router } from 'express';
import { z } from 'zod';
import * as fin from '../../controllers/financeController';
import * as eng from '../../controllers/engagementController';
import { authenticate, requireAnyPermission, requirePermission, requireUserType } from '../../middleware/auth';
import { validate, validateBodyBy } from '../../middleware/validate';
import { perm, SharedLinks } from '../../constants';
import { REPORT_KEYS } from '../../constants/reports';
import { idParams, listQuery } from '../../validations/common';
import { draftInvoiceListQuery, draftInvoiceUpdateSchema, amcCancelSchema, amcCreateSchema, amcListQuery, amcUpdateSchema, amcVisitBookSchema, amcVisitListQuery, auditListQuery, globalSearchQuery, integrationCredentialSchemas, integrationNameParams, integrationTestSchema, invoiceCancelSchema, invoiceFromBookingSchema, invoiceLineSchema, invoiceListQuery, invoiceManualSchema, invoiceShareSchema, ledgerAdjustmentSchema, notificationReadSchema, paymentCreateSchema, paymentListQuery, paymentRefundSchema, paymentVerifySchema, razorpayCredentialsSchema, razorpayTestSchema, reminderCreateSchema, reminderListQuery, reminderUpdateSchema, reportQuery, settingKeyParams, settingValueSchema, settingValueSchemas, shareQuery, templateUpdateSchema } from '../../validations/finance';

const r = Router();
const invoicePreviewSchema = z.object({
  lines: z.array(invoiceLineSchema).min(1).max(50),
  applyGst: z.boolean().default(true),
  isInterState: z.boolean().default(false),
  discount: z.coerce.number().min(0).default(0),
  isFreeService: z.boolean().default(false),
});
const admin = requireUserType('ADMIN');

// ─── Invoices ───
r.get('/invoices', authenticate, admin, requirePermission(perm('invoices', 'view')), validate({ query: invoiceListQuery }), fin.listInvoices);
r.post('/invoices/preview', authenticate, admin, requireAnyPermission(perm('invoices', 'create'), perm('forInvoice', 'create'), perm('forInvoice', 'edit')), validate({ body: invoicePreviewSchema }), fin.previewInvoice);

// ─── For Invoice: bills of completed jobs, edited and then approved (audited) into invoices ───
r.get('/draft-invoices', authenticate, admin, requirePermission(perm('forInvoice', 'view')), validate({ query: draftInvoiceListQuery }), fin.listDraftInvoices);
r.post('/draft-invoices', authenticate, admin, requirePermission(perm('forInvoice', 'create')), validate({ body: invoiceFromBookingSchema }), fin.generateDraftInvoice);
r.get('/draft-invoices/:id', authenticate, admin, requirePermission(perm('forInvoice', 'view')), validate({ params: idParams }), fin.getDraftInvoice);
r.patch('/draft-invoices/:id', authenticate, admin, requirePermission(perm('forInvoice', 'edit')), validate({ params: idParams, body: draftInvoiceUpdateSchema }), fin.updateDraftInvoice);
r.post('/draft-invoices/:id/approve', authenticate, admin, requirePermission(perm('forInvoice', 'audit')), validate({ params: idParams }), fin.approveDraftInvoice);
r.post('/draft-invoices/:id/discard', authenticate, admin, requirePermission(perm('forInvoice', 'edit')), validate({ params: idParams, body: invoiceCancelSchema }), fin.discardDraftInvoice);

r.post('/invoices', authenticate, admin, requirePermission(perm('invoices', 'create')), validate({ body: invoiceManualSchema }), fin.createManualInvoice);
r.post('/invoices/share', authenticate, admin, requirePermission(perm('invoices', 'view')), validate({ body: invoiceShareSchema }), fin.shareInvoices);
r.get('/invoices/:id', authenticate, admin, requirePermission(perm('invoices', 'view')), validate({ params: idParams }), fin.getInvoice);
// Public: the signed token is the authorisation (see SharedLinks / ShareService.publicInvoicePdf).
r.get(SharedLinks.INVOICE_PDF_ROUTE, fin.publicInvoicePdf);
r.get('/invoices/:id/pdf', authenticate, admin, requirePermission(perm('invoices', 'view')), validate({ params: idParams }), fin.invoicePdf);
r.post('/invoices/:id/cancel', authenticate, admin, requirePermission(perm('invoices', 'delete')), validate({ params: idParams, body: invoiceCancelSchema }), fin.cancelInvoice);

// ─── Payments ───
r.get('/payments', authenticate, admin, requirePermission(perm('payments', 'view')), validate({ query: paymentListQuery }), fin.listPayments);
r.post('/payments', authenticate, admin, requirePermission(perm('payments', 'create')), validate({ body: paymentCreateSchema }), fin.recordPayment);
r.get('/payments/accounts', authenticate, admin, requireAnyPermission(perm('payments', 'view'), perm('payments', 'create')), fin.receivingAccounts);
r.get('/payments/:id', authenticate, admin, requirePermission(perm('payments', 'view')), validate({ params: idParams }), fin.getPayment);
r.post('/payments/:id/verify', authenticate, admin, requirePermission(perm('payments', 'approve')), validate({ params: idParams, body: paymentVerifySchema }), fin.verifyPayment);
r.post('/payments/:id/refund', authenticate, admin, requirePermission(perm('payments', 'approve')), validate({ params: idParams, body: paymentRefundSchema }), fin.refundPayment);
r.post('/payments/razorpay/webhook', fin.razorpayWebhook);

// ─── Ledger & finance ───
r.post('/ledger/adjustments', authenticate, admin, requirePermission(perm('ledger', 'create')), validate({ body: ledgerAdjustmentSchema }), fin.ledgerAdjust);
r.get('/ledger/customers', authenticate, admin, requirePermission(perm('ledger', 'view')), validate({ query: listQuery }), fin.ledgerCustomers);
r.get('/ledger/outstanding',authenticate, admin, requirePermission(perm('ledger', 'view')), validate({ query: listQuery }), fin.outstanding);
r.get('/finance/summary', authenticate, admin, requireAnyPermission(perm('invoices', 'view'), perm('reports', 'view')), validate({ query: reportQuery }), fin.financeSummary);

// ─── AMC ───
r.get('/amc', authenticate, admin, requirePermission(perm('amc', 'view')), validate({ query: amcListQuery }), fin.listAmc);
r.post('/amc', authenticate, admin, requirePermission(perm('amc', 'create')), validate({ body: amcCreateSchema }), fin.createAmc);
r.get('/amc/visits', authenticate, admin, requirePermission(perm('amc', 'view')), validate({ query: amcVisitListQuery }), fin.listAmcVisits);
r.post('/amc/visits/:id/book', authenticate, admin, requirePermission(perm('amc', 'edit')), validate({ params: idParams, body: amcVisitBookSchema }), fin.bookAmcVisit);
r.get('/amc/:id', authenticate, admin, requirePermission(perm('amc', 'view')), validate({ params: idParams }), fin.getAmc);
r.patch('/amc/:id', authenticate, admin, requirePermission(perm('amc', 'edit')), validate({ params: idParams, body: amcUpdateSchema }), fin.updateAmc);
r.post('/amc/:id/invoice', authenticate, admin, requirePermission(perm('amc', 'edit')), validate({ params: idParams }), fin.issueAmcInvoice);
r.post('/amc/:id/activate', authenticate, admin, requirePermission(perm('amc', 'approve')), validate({ params: idParams }), fin.activateAmc);
r.post('/amc/:id/cancel', authenticate, admin, requirePermission(perm('amc', 'approve')), validate({ params: idParams, body: amcCancelSchema }), fin.cancelAmc);

// ─── Reminders ───
r.get('/reminders', authenticate, admin, requirePermission(perm('reminders', 'view')), validate({ query: reminderListQuery }), eng.listReminders);
r.get('/reminders/summary', authenticate, admin, requirePermission(perm('reminders', 'view')), eng.reminderSummary);
r.post('/reminders', authenticate, admin, requirePermission(perm('reminders', 'create')), validate({ body: reminderCreateSchema }), eng.createReminder);
r.patch('/reminders/:id', authenticate, admin, requirePermission(perm('reminders', 'edit')), validate({ params: idParams, body: reminderUpdateSchema }), eng.updateReminder);

// ─── Notifications (any signed-in user — own notifications only) ───
r.get('/notifications', authenticate, validate({ query: listQuery }), eng.listNotifications);
r.post('/notifications/read', authenticate, validate({ body: notificationReadSchema }), eng.markNotificationsRead);

// ─── Settings & audit ───
r.get('/settings', authenticate, admin, requirePermission(perm('settings', 'view')), eng.getSettings);
r.put('/settings/:key', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ params: settingKeyParams, body: settingValueSchema }), validateBodyBy((req) => settingValueSchemas[req.params.key as keyof typeof settingValueSchemas]), eng.updateSetting);
// Razorpay keys: status is readable, secrets are write-only (never returned).
r.get('/settings/integrations/razorpay', authenticate, admin, requirePermission(perm('settings', 'view')), eng.getRazorpayKeys);
r.put('/settings/integrations/razorpay', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ body: razorpayCredentialsSchema }), eng.saveRazorpayKeys);
r.delete('/settings/integrations/razorpay', authenticate, admin, requirePermission(perm('settings', 'manage')), eng.clearRazorpayKeys);
r.post('/settings/integrations/razorpay/test', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ body: razorpayTestSchema }), eng.testRazorpayKeys);
// SMTP / FCM / WhatsApp Cloud credentials (after the fixed /razorpay routes). Secrets are write-only.
r.get('/settings/integrations/:name', authenticate, admin, requirePermission(perm('settings', 'view')), validate({ params: integrationNameParams }), eng.getIntegration);
r.put('/settings/integrations/:name', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ params: integrationNameParams }), validateBodyBy((req) => integrationCredentialSchemas[req.params.name as keyof typeof integrationCredentialSchemas]), eng.saveIntegration);
r.delete('/settings/integrations/:name', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ params: integrationNameParams }), eng.clearIntegration);
r.post('/settings/integrations/:name/test', authenticate, admin, requirePermission(perm('settings', 'manage')), validate({ params: integrationNameParams, body: integrationTestSchema }), eng.testIntegration);
r.get('/notification-templates', authenticate, admin, requirePermission(perm('notifications', 'view')), eng.listTemplates);
r.patch('/notification-templates/:id', authenticate, admin, requirePermission(perm('notifications', 'manage')), validate({ params: idParams, body: templateUpdateSchema }), eng.updateTemplate);
r.get('/audit-logs', authenticate, admin, requirePermission(perm('auditLogs', 'view')), validate({ query: auditListQuery }), eng.listAuditLogs);

// ─── Share ───
r.get('/share/whatsapp', authenticate, admin, validate({ query: shareQuery }), eng.whatsappShare);

// ─── Dashboard, reports, search ───
r.get('/dashboard', authenticate, admin, requirePermission(perm('dashboard', 'view')), validate({ query: reportQuery }), eng.dashboard);
r.get('/search', authenticate, admin, validate({ query: globalSearchQuery }), eng.globalSearch);
r.get(
  '/reports/:key',
  authenticate,
  admin,
  requirePermission(perm('reports', 'view')),
  validate({ params: z.object({ key: z.enum(REPORT_KEYS as [string, ...string[]]) }), query: reportQuery }),
  (req, res, next) => (req.query.format && req.query.format !== 'json' ? requirePermission(perm('reports', 'export'))(req, res, next) : next()),
  eng.report,
);

export { r as financeRoutes };
