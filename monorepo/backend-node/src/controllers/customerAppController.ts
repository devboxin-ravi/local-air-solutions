/**
 * Customer self-service endpoints (/me/*) for the mobile app — HTTP only.
 * Every query is scoped to the authenticated customer in the service layer.
 */

import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, idParam, sendCreated, sendNoContent, sendOk } from '../utils/http';
import { ForbiddenError } from '../utils/errors';
import { ErrorMessages } from '../constants';

const customerId = (req: Parameters<typeof actorOf>[0]): number => {
  const id = actorOf(req).customerId;
  if (!id) throw new ForbiddenError(ErrorMessages.NO_CUSTOMER_PROFILE);
  return id;
};

export const getProfile = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.getOwnProfile(actorOf(req)));
});
export const updateProfile = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.updateOwnProfile(actorOf(req), req.body));
});
export const listAddresses = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.listAddresses(customerId(req)));
});
export const addAddress = asyncHandler(async (req, res) => {
  sendCreated(res, await services().customers.addAddress(customerId(req), req.body));
});
export const updateAddress = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.updateAddress(customerId(req), idParam(req), req.body));
});
export const deleteAddress = asyncHandler(async (req, res) => {
  await services().customers.removeAddress(customerId(req), idParam(req));
  sendNoContent(res);
});
export const myBookings = asyncHandler(async (req, res) => {
  const r = await services().bookings.list(actorOf(req), { ...(req.query as Record<string, unknown>), customerId: customerId(req) } as never);
  res.json({ success: true, data: r.items, meta: r.meta });
});
export const myLedger = asyncHandler(async (req, res) => {
  sendOk(res, await services().ledger.statement(actorOf(req), customerId(req), req.query as never));
});
export const myHome = asyncHandler(async (req, res) => {
  const actor = actorOf(req);
  const id = customerId(req);
  const [upcoming, reminders, amc, balance] = await Promise.all([
    services().bookings.list(actor, { customerId: id, status: ['CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PAYMENT_VERIFICATION', 'RESCHEDULED'], page: 1, pageSize: 3, sortOrder: 'asc', sortBy: 'scheduledDate', dateField: 'createdAt' } as never),
    services().reminders.list(actor, { bucket: 'all', page: 1, pageSize: 3 } as never),
    services().amc.list(actor, { page: 1, pageSize: 3 } as never),
    services().ledger.balance(id),
  ]);
  sendOk(res, {
    upcomingBookings: upcoming.items,
    reminders: reminders.items.filter((r) => r.status !== 'COMPLETED' && r.status !== 'DISMISSED'),
    amcContracts: amc.items,
    outstandingBalance: balance,
  });
});
