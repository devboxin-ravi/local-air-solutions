/**
 * Bookings, slots, assignments and technician-app controllers — HTTP only.
 */

import { services } from '../dependencies/dependencies';
import type { UploadedFileInfo } from '../models';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendNoContent, sendOk, sendPage } from '../utils/http';

const files = (res: { locals: Record<string, unknown> }): UploadedFileInfo[] => (res.locals.files as UploadedFileInfo[]) ?? [];

// ─── Slots ───
export const listSlots = asyncHandler(async (req, res) => {
  sendOk(res, await services().slots.list(actorOf(req), req.query as never));
});
export const availableSlots = asyncHandler(async (req, res) => {
  sendOk(res, await services().slots.availableFor(Number(req.query.branchId), String(req.query.date)));
});
export const generateSlots = asyncHandler(async (req, res) => {
  sendCreated(res, await services().slots.generate(actorOf(req), req.body, metaOf(req)));
});
export const createSlot = asyncHandler(async (req, res) => {
  sendCreated(res, await services().slots.create(actorOf(req), req.body));
});
export const updateSlot = asyncHandler(async (req, res) => {
  sendOk(res, await services().slots.update(actorOf(req), idParam(req), req.body));
});
export const deleteSlot = asyncHandler(async (req, res) => {
  await services().slots.remove(actorOf(req), idParam(req));
  sendNoContent(res);
});

// ─── Bookings ───
export const listBookings = asyncHandler(async (req, res) => {
  sendPage(res, await services().bookings.list(actorOf(req), req.query as never));
});
export const bookingCalendar = asyncHandler(async (req, res) => {
  const q = req.query as unknown as { branchId?: number; from: string; to: string };
  sendOk(res, await services().bookings.calendar(actorOf(req), q.branchId, q.from, q.to));
});
export const getBooking = asyncHandler(async (req, res) => {
  sendOk(res, await services().bookings.get(actorOf(req), idParam(req)));
});
export const createBooking = asyncHandler(async (req, res) => {
  sendCreated(res, await services().bookings.create(actorOf(req), req.body, metaOf(req)));
});
export const updateBooking = asyncHandler(async (req, res) => {
  sendOk(res, await services().bookings.update(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const changeBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (status === 'COMPLETED') {
    sendOk(res, await services().assignments.adminComplete(actorOf(req), idParam(req), note, metaOf(req)));
    return;
  }
  sendOk(res, await services().bookings.changeStatus(actorOf(req), idParam(req), status, note, metaOf(req)));
});
export const cancelBooking = asyncHandler(async (req, res) => {
  sendOk(res, await services().bookings.cancel(actorOf(req), idParam(req), req.body.reason, metaOf(req)));
});
export const rescheduleBooking = asyncHandler(async (req, res) => {
  sendOk(res, await services().bookings.reschedule(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const addBookingNote = asyncHandler(async (req, res) => {
  sendCreated(res, await services().bookings.addNote(actorOf(req), idParam(req), req.body.note));
});
export const addBookingAttachments = asyncHandler(async (req, res) => {
  const kind = req.user?.userType === 'CUSTOMER' ? 'CUSTOMER_UPLOAD' : ((req.body.kind as 'BEFORE' | 'AFTER' | 'OTHER') ?? 'OTHER');
  sendCreated(res, await services().bookings.addAttachments(actorOf(req), idParam(req), kind, files(res)));
});
export const bookingTracking = asyncHandler(async (req, res) => {
  sendOk(res, await services().bookings.tracking(actorOf(req), idParam(req)));
});

// ─── Assignments ───
export const listAssignments = asyncHandler(async (req, res) => {
  sendPage(res, await services().assignments.list(actorOf(req), req.query as never));
});
export const suggestTechnicians = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.suggest(actorOf(req), idParam(req)));
});
export const assignTechnician = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.assign(actorOf(req), idParam(req), req.body.staffId, req.body.notes, metaOf(req)));
});
export const unassignTechnician = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.unassign(actorOf(req), idParam(req), metaOf(req)));
});
export const technicianAvailability = asyncHandler(async (req, res) => {
  const q = req.query as unknown as { branchId?: number; date: string };
  sendOk(res, await services().assignments.availability(actorOf(req), q.branchId, q.date));
});

// ─── Technician app ───
export const techDashboard = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.myDashboard(actorOf(req)));
});
export const techJobs = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.myJobs(actorOf(req), (req.query.scope as never) ?? 'today'));
});
export const techJob = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.myJob(actorOf(req), idParam(req)));
});
export const techRespond = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.respond(actorOf(req), idParam(req), req.body.accept, req.body.reason, metaOf(req)));
});
export const techStatus = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.updateJobStatus(actorOf(req), idParam(req), req.body.status, req.body.note));
});
export const techComplete = asyncHandler(async (req, res) => {
  sendOk(res, await services().assignments.complete(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const techNote = asyncHandler(async (req, res) => {
  sendCreated(res, await services().assignments.addJobNote(actorOf(req), idParam(req), req.body.note));
});
export const techPhotos = asyncHandler(async (req, res) => {
  sendCreated(res, await services().assignments.uploadJobPhotos(actorOf(req), idParam(req), (req.body.kind as never) ?? 'OTHER', files(res)));
});
