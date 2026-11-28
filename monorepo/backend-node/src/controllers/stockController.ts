/**
 * Stock controllers — HTTP only.
 */

import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendNoContent, sendOk } from '../utils/http';

export const listStock = asyncHandler(async (req, res) => {
  sendOk(res, await services().stock.list(actorOf(req), req.query as never));
});
export const createStockItem = asyncHandler(async (req, res) => {
  sendCreated(res, await services().stock.create(actorOf(req), req.body, metaOf(req)));
});
export const updateStockItem = asyncHandler(async (req, res) => {
  sendOk(res, await services().stock.update(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const adjustStock = asyncHandler(async (req, res) => {
  sendOk(res, await services().stock.adjust(actorOf(req), idParam(req), req.body, metaOf(req)));
});
export const deleteStockItem = asyncHandler(async (req, res) => {
  await services().stock.remove(actorOf(req), idParam(req), metaOf(req));
  sendNoContent(res);
});
