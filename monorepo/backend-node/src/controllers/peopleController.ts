/**
 * Customers, staff and roles controllers — HTTP only.
 */

import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendNoContent, sendOk, sendPage } from '../utils/http';

// ─── Customers ───
export const listCustomers = asyncHandler(async (req, res) => {
  sendPage(res, await services().customers.list(actorOf(req), req.query as never));
});
export const getCustomer = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.get(actorOf(req), idParam(req)));
});
export const checkDuplicateMobile = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.checkDuplicates(String(req.query.mobile ?? '')));
});
export const createCustomer = asyncHandler(async (req, res) => {
  sendCreated(res, await services().customers.create(actorOf(req), req.body, metaOf(req)));
});
export const updateCustomer = asyncHandler(async (req, res) => {
  sendOk(res, await services().customers.update(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const deleteCustomer = asyncHandler(async (req, res) => {
  await services().customers.remove(actorOf(req), idParam(req), metaOf(req));
  sendNoContent(res);
});
export const listAllAddresses = asyncHandler(async (req, res) => {
  sendPage(res, await services().customers.listAllAddresses(actorOf(req), req.query as never));
});
export const listCustomerAddresses = asyncHandler(async (req, res) => {
  await services().customers.get(actorOf(req), idParam(req));
  sendOk(res, await services().customers.listAddresses(idParam(req)));
});
export const addCustomerAddress = asyncHandler(async (req, res) => {
  await services().customers.get(actorOf(req), idParam(req));
  sendCreated(res, await services().customers.addAddress(idParam(req), req.body));
});
export const updateCustomerAddress = asyncHandler(async (req, res) => {
  await services().customers.get(actorOf(req), idParam(req));
  sendOk(res, await services().customers.updateAddress(idParam(req), idParam(req, 'addressId'), req.body));
});
export const deleteCustomerAddress = asyncHandler(async (req, res) => {
  await services().customers.get(actorOf(req), idParam(req));
  await services().customers.removeAddress(idParam(req), idParam(req, 'addressId'));
  sendNoContent(res);
});
export const customerLedger = asyncHandler(async (req, res) => {
  sendOk(res, await services().ledger.statement(actorOf(req), idParam(req), req.query as never));
});

// ─── Staff ───
export const listStaff = asyncHandler(async (req, res) => {
  sendPage(res, await services().staff.list(actorOf(req), req.query as never));
});
export const getStaff = asyncHandler(async (req, res) => {
  sendOk(res, await services().staff.get(actorOf(req), idParam(req)));
});
export const createStaff = asyncHandler(async (req, res) => {
  sendCreated(res, await services().staff.create(actorOf(req), req.body, metaOf(req)));
});
export const updateStaff = asyncHandler(async (req, res) => {
  sendOk(res, await services().staff.update(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const staffHistory = asyncHandler(async (req, res) => {
  const q = req.query as { page?: number; pageSize?: number };
  sendPage(res, await services().staff.workHistory(actorOf(req), idParam(req), q.page, q.pageSize));
});

// ─── Roles & permissions ───
export const listRoles = asyncHandler(async (_req, res) => {
  sendOk(res, await services().staff.listRoles());
});
export const listPermissions = asyncHandler(async (_req, res) => {
  sendOk(res, await services().staff.listPermissions());
});
export const createRole = asyncHandler(async (req, res) => {
  sendCreated(res, await services().staff.createRole(actorOf(req), req.body, metaOf(req)));
});
export const updateRole = asyncHandler(async (req, res) => {
  sendOk(res, await services().staff.updateRole(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const deleteRole = asyncHandler(async (req, res) => {
  await services().staff.deleteRole(actorOf(req), idParam(req), metaOf(req));
  sendNoContent(res);
});
