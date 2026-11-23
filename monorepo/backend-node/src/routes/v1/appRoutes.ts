/**
 * Mobile app routes: /me/* (customer) and /technician/* (field staff) — route definitions only.
 */

import { Router } from 'express';
import { z } from 'zod';
import * as me from '../../controllers/customerAppController';
import * as ops from '../../controllers/operationsController';
import * as fin from '../../controllers/financeController';
import { authenticate, requireTechnician, requireUserType } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadFiles } from '../../middleware/upload';
import { UploadRules } from '../../constants';
import { idParams, listQuery, name, optionalEmail, optionalMobile } from '../../validations/common';
import { addressInput } from '../../validations/auth';
import {
  bookingCancelSchema,
  bookingCreateSchema,
  bookingListQuery,
  noteSchema,
  techCompleteSchema,
  techJobsQuery,
  techRespondSchema,
  techStatusSchema,
} from '../../validations/operations';
import { amcListQuery, invoiceListQuery, ledgerQuery, paymentListQuery, razorpayOrderSchema, razorpayVerifySchema, reminderListQuery } from '../../validations/finance';
import * as eng from '../../controllers/engagementController';

// ─── Customer ───
const c = Router();
c.use(authenticate, requireUserType('CUSTOMER'));

c.get('/home', me.myHome);
c.get('/profile', me.getProfile);
c.patch('/profile', validate({ body: z.object({ fullName: name.optional(), email: optionalEmail, alternateMobile: optionalMobile }) }), me.updateProfile);
c.get('/addresses', me.listAddresses);
c.post('/addresses', validate({ body: addressInput.extend({ isDefault: z.boolean().default(false) }) }), me.addAddress);
c.patch('/addresses/:id', validate({ params: idParams, body: addressInput.partial().extend({ isDefault: z.boolean().optional() }) }), me.updateAddress);
c.delete('/addresses/:id', validate({ params: idParams }), me.deleteAddress);

c.get('/bookings', validate({ query: bookingListQuery }), me.myBookings);
c.post('/bookings', validate({ body: bookingCreateSchema }), ops.createBooking);
c.get('/bookings/:id', validate({ params: idParams }), ops.bookingTracking);
c.post('/bookings/:id/cancel', validate({ params: idParams, body: bookingCancelSchema }), ops.cancelBooking);
c.post('/bookings/:id/attachments', validate({ params: idParams }), uploadFiles('customer', 'files', UploadRules.MEDIA_MIME_TYPES), ops.addBookingAttachments);

c.get('/invoices', validate({ query: invoiceListQuery }), fin.listInvoices);
c.get('/invoices/:id', validate({ params: idParams }), fin.getInvoice);
c.get('/invoices/:id/pdf', validate({ params: idParams }), fin.invoicePdf);
c.get('/payments', validate({ query: paymentListQuery }), fin.listPayments);
c.post('/payments/upi', uploadFiles('payments', 'proof', UploadRules.IMAGE_MIME_TYPES, 1), fin.submitUpiPayment);
c.post('/payments/razorpay/order', validate({ body: razorpayOrderSchema }), fin.createRazorpayOrder);
c.post('/payments/razorpay/verify', validate({ body: razorpayVerifySchema }), fin.verifyRazorpay);
c.get('/ledger', validate({ query: ledgerQuery }), me.myLedger);
c.get('/amc', validate({ query: amcListQuery }), fin.listAmc);
c.get('/amc/:id', validate({ params: idParams }), fin.getAmc);
c.get('/reminders', validate({ query: reminderListQuery }), eng.listReminders);

// ─── Technician ───
const t = Router();
t.use(authenticate, requireTechnician);

t.get('/dashboard', ops.techDashboard);
t.get('/jobs', validate({ query: techJobsQuery }), ops.techJobs);
t.get('/jobs/:id', validate({ params: idParams }), ops.techJob);
t.post('/jobs/:id/respond', validate({ params: idParams, body: techRespondSchema }), ops.techRespond);
t.post('/jobs/:id/status', validate({ params: idParams, body: techStatusSchema }), ops.techStatus);
t.post('/jobs/:id/complete', validate({ params: idParams, body: techCompleteSchema }), ops.techComplete);
t.post('/jobs/:id/notes', validate({ params: idParams, body: noteSchema }), ops.techNote);
t.post('/jobs/:id/photos', validate({ params: idParams }), uploadFiles('jobs', 'files', UploadRules.IMAGE_MIME_TYPES), ops.techPhotos);
t.get('/history', validate({ query: listQuery }), (req, res, next) => {
  req.query = { ...req.query, scope: 'history' } as never;
  ops.techJobs(req, res, next);
});

export { c as customerAppRoutes, t as technicianRoutes };
