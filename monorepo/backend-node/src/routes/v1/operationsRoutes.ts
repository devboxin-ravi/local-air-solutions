/**
 * Customers, staff, roles, slots, bookings, assignments — route definitions only.
 */

import { Router } from 'express';
import { z } from 'zod';
import * as people from '../../controllers/peopleController';
import * as ops from '../../controllers/operationsController';
import { authenticate, requireAnyPermission, requirePermission, requireUserType } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadFiles } from '../../middleware/upload';
import { perm, UploadRules } from '../../constants';
import { id, idParams, listQuery } from '../../validations/common';
import {
  addressListQuery,
  addressSchema,
  addressUpdateSchema,
  assignmentListQuery,
  assignSchema,
  availabilityQuery,
  bookingCancelSchema,
  bookingCreateSchema,
  bookingListQuery,
  bookingRescheduleSchema,
  bookingStatusSchema,
  bookingUpdateSchema,
  calendarQuery,
  customerListQuery,
  customerSchema,
  customerUpdateSchema,
  noteSchema,
  slotGenerateSchema,
  slotListQuery,
  slotSchema,
  slotUpdateSchema,
  staffListQuery,
  staffSchema,
  staffUpdateSchema,
} from '../../validations/operations';
import { ledgerQuery, roleSchema, roleUpdateSchema } from '../../validations/finance';
import { mobile } from '../../validations/common';

const r = Router();
const admin = requireUserType('ADMIN');
const addressParams = z.object({ id, addressId: id });

// ─── Customers ───
r.get('/customers', authenticate, admin, requirePermission(perm('customers', 'view')), validate({ query: customerListQuery }), people.listCustomers);
r.get('/customers/check-mobile', authenticate, admin, requirePermission(perm('customers', 'view')), validate({ query: z.object({ mobile }) }), people.checkDuplicateMobile);
r.get('/customers/addresses', authenticate, admin, requirePermission(perm('customers', 'view')), validate({ query: addressListQuery }), people.listAllAddresses);
r.post('/customers', authenticate, admin, requirePermission(perm('customers', 'create')), validate({ body: customerSchema }), people.createCustomer);
r.get('/customers/:id', authenticate, admin, requirePermission(perm('customers', 'view')), validate({ params: idParams }), people.getCustomer);
r.patch('/customers/:id', authenticate, admin, requirePermission(perm('customers', 'edit')), validate({ params: idParams, body: customerUpdateSchema }), people.updateCustomer);
r.delete('/customers/:id', authenticate, admin, requirePermission(perm('customers', 'delete')), validate({ params: idParams }), people.deleteCustomer);
r.get('/customers/:id/addresses', authenticate, admin, requirePermission(perm('customers', 'view')), validate({ params: idParams }), people.listCustomerAddresses);
r.post('/customers/:id/addresses', authenticate, admin, requirePermission(perm('customers', 'edit')), validate({ params: idParams, body: addressSchema }), people.addCustomerAddress);
r.patch('/customers/:id/addresses/:addressId', authenticate, admin, requirePermission(perm('customers', 'edit')), validate({ params: addressParams, body: addressUpdateSchema }), people.updateCustomerAddress);
r.delete('/customers/:id/addresses/:addressId', authenticate, admin, requirePermission(perm('customers', 'edit')), validate({ params: addressParams }), people.deleteCustomerAddress);
r.get('/customers/:id/ledger', authenticate, admin, requirePermission(perm('ledger', 'view')), validate({ params: idParams, query: ledgerQuery }), people.customerLedger);

// ─── Staff ───
r.get('/staff', authenticate, admin, requireAnyPermission(perm('staff', 'view'), perm('assignments', 'assign')), validate({ query: staffListQuery }), people.listStaff);
r.post('/staff', authenticate, admin, requirePermission(perm('staff', 'create')), validate({ body: staffSchema }), people.createStaff);
r.get('/staff/:id', authenticate, admin, requirePermission(perm('staff', 'view')), validate({ params: idParams }), people.getStaff);
r.patch('/staff/:id', authenticate, admin, requirePermission(perm('staff', 'edit')), validate({ params: idParams, body: staffUpdateSchema }), people.updateStaff);
// Staff are never deleted: they are deactivated or suspended (with a reason) from the edit form.
r.get('/staff/:id/history', authenticate, admin, requirePermission(perm('staff', 'view')), validate({ params: idParams, query: listQuery }), people.staffHistory);

// ─── Roles & permissions ───
r.get('/roles', authenticate, admin, requireAnyPermission(perm('roles', 'view'), perm('staff', 'view')), people.listRoles);
r.get('/permissions', authenticate, admin, requirePermission(perm('roles', 'view')), people.listPermissions);
r.post('/roles', authenticate, admin, requirePermission(perm('roles', 'manage')), validate({ body: roleSchema }), people.createRole);
r.patch('/roles/:id', authenticate, admin, requirePermission(perm('roles', 'manage')), validate({ params: idParams, body: roleUpdateSchema }), people.updateRole);
r.delete('/roles/:id', authenticate, admin, requirePermission(perm('roles', 'manage')), validate({ params: idParams }), people.deleteRole);

// ─── Slots ───
r.get('/slots/available', validate({ query: z.object({ branchId: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) }), ops.availableSlots);
r.get('/slots', authenticate, admin, requirePermission(perm('slots', 'view')), validate({ query: slotListQuery }), ops.listSlots);
r.post('/slots/generate', authenticate, admin, requirePermission(perm('slots', 'create')), validate({ body: slotGenerateSchema }), ops.generateSlots);
r.post('/slots', authenticate, admin, requirePermission(perm('slots', 'create')), validate({ body: slotSchema }), ops.createSlot);
r.patch('/slots/:id', authenticate, admin, requirePermission(perm('slots', 'edit')), validate({ params: idParams, body: slotUpdateSchema }), ops.updateSlot);
r.delete('/slots/:id', authenticate, admin, requirePermission(perm('slots', 'delete')), validate({ params: idParams }), ops.deleteSlot);

// ─── Bookings (admin) ───
r.get('/bookings', authenticate, admin, requirePermission(perm('bookings', 'view')), validate({ query: bookingListQuery }), ops.listBookings);
r.get('/bookings/calendar', authenticate, admin, requirePermission(perm('bookings', 'view')), validate({ query: calendarQuery }), ops.bookingCalendar);
r.post('/bookings', authenticate, admin, requirePermission(perm('bookings', 'create')), validate({ body: bookingCreateSchema }), ops.createBooking);
r.get('/bookings/:id', authenticate, admin, requirePermission(perm('bookings', 'view')), validate({ params: idParams }), ops.getBooking);
r.patch('/bookings/:id', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams, body: bookingUpdateSchema }), ops.updateBooking);
r.post('/bookings/:id/status', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams, body: bookingStatusSchema }), ops.changeBookingStatus);
r.post('/bookings/:id/cancel', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams, body: bookingCancelSchema }), ops.cancelBooking);
r.post('/bookings/:id/reschedule', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams, body: bookingRescheduleSchema }), ops.rescheduleBooking);
r.post('/bookings/:id/notes', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams, body: noteSchema }), ops.addBookingNote);
r.post('/bookings/:id/attachments', authenticate, admin, requirePermission(perm('bookings', 'edit')), validate({ params: idParams }), uploadFiles('jobs', 'files', UploadRules.MEDIA_MIME_TYPES), ops.addBookingAttachments);

// ─── Assignments ───
r.get('/assignments', authenticate, admin, requirePermission(perm('assignments', 'view')), validate({ query: assignmentListQuery }), ops.listAssignments);
r.get('/assignments/availability', authenticate, admin, requirePermission(perm('assignments', 'view')), validate({ query: availabilityQuery }), ops.technicianAvailability);
r.get('/bookings/:id/suggestions', authenticate, admin, requirePermission(perm('assignments', 'assign')), validate({ params: idParams }), ops.suggestTechnicians);
r.post('/bookings/:id/assign', authenticate, admin, requirePermission(perm('assignments', 'assign')), validate({ params: idParams, body: assignSchema }), ops.assignTechnician);
r.post('/bookings/:id/unassign', authenticate, admin, requirePermission(perm('assignments', 'assign')), validate({ params: idParams }), ops.unassignTechnician);

export { r as operationsRoutes };
