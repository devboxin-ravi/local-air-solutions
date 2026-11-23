/**
 * Reminders, notifications, settings, audit, sharing, dashboard, reports & search — HTTP only.
 */

import { Response } from 'express';
import { services } from '../dependencies/dependencies';
import type { ExportColumn } from '../services/documentService';
import type { AuthUser } from '../models';
import { actorOf, asyncHandler, idParam, metaOf, sendCreated, sendOk, sendPage } from '../utils/http';
import { REPORT_DEFINITIONS, ReportKey } from '../constants/reports';

// ─── Reminders ───
export const listReminders = asyncHandler(async (req, res) => {
  sendPage(res, await services().reminders.list(actorOf(req), req.query as never));
});
export const reminderSummary = asyncHandler(async (req, res) => {
  sendOk(res, await services().reminders.summary(actorOf(req), req.query.branchId ? Number(req.query.branchId) : undefined));
});
export const createReminder = asyncHandler(async (req, res) => {
  sendCreated(res, await services().reminders.create(req.body));
});
export const updateReminder = asyncHandler(async (req, res) => {
  sendOk(res, await services().reminders.update(idParam(req), req.body));
});

// ─── Notifications ───
export const listNotifications = asyncHandler(async (req, res) => {
  const q = req.query as { page?: number; pageSize?: number };
  const r = await services().notifications.list(actorOf(req).id, q.page, q.pageSize);
  res.json({ success: true, data: r.items, meta: r.meta });
});
export const markNotificationsRead = asyncHandler(async (req, res) => {
  sendOk(res, await services().notifications.markRead(actorOf(req).id, req.body.ids));
});

// ─── Settings & audit ───
export const getSettings = asyncHandler(async (_req, res) => {
  sendOk(res, await services().settings.getAll());
});
export const updateSetting = asyncHandler(async (req, res) => {
  sendOk(res, await services().settings.update(req.params.key as never, req.body, actorOf(req), metaOf(req)));
});
export const listTemplates = asyncHandler(async (_req, res) => {
  sendOk(res, await services().settings.listTemplates());
});
export const updateTemplate = asyncHandler(async (req, res) => {
  sendOk(res, await services().settings.updateTemplate(idParam(req), req.body, actorOf(req), metaOf(req)));
});
export const listAuditLogs = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | number | undefined>;
  sendPage(
    res,
    await services().settings.listAudit({
      ...q,
      from: q.from ? new Date(`${q.from}T00:00:00Z`) : undefined,
      to: q.to ? new Date(`${q.to}T23:59:59Z`) : undefined,
    } as never),
  );
});

// ─── Share ───
export const whatsappShare = asyncHandler(async (req, res) => {
  const q = req.query as unknown as { type: 'booking' | 'assignment' | 'invoice' | 'paymentReminder' | 'serviceReminder'; id: number };
  sendOk(res, await services().share.whatsapp(actorOf(req), q.type, q.id));
});

// ─── Dashboard, reports, search ───
export const dashboard = asyncHandler(async (req, res) => {
  sendOk(res, await services().reports.dashboard(actorOf(req), req.query as never));
});

export const globalSearch = asyncHandler(async (req, res) => {
  const q = req.query as unknown as { q: string; branchId?: number };
  sendOk(res, await services().reports.globalSearch(actorOf(req), q.q, q.branchId));
});

const runReport = (key: ReportKey, actor: AuthUser, q: never): Promise<Record<string, unknown>[]> => {
  const r = services().reports;
  const map: Record<ReportKey, () => Promise<Record<string, unknown>[]>> = {
    bookings: () => r.bookingReport(actor, q),
    revenue: () => r.revenueReport(actor, q),
    services: () => r.serviceReport(actor, q),
    staff: () => r.staffReport(actor, q),
    branches: () => r.branchReport(actor, q),
    customers: () => r.customerReport(actor, q),
    gst: () => r.gstReport(actor, q),
    payments: () => r.paymentReport(actor, q),
    amc: () => r.amcReport(actor, q),
  };
  return map[key]();
};

const sendFile = (res: Response, buf: Buffer, type: string, name: string) => {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(buf);
};

export const report = asyncHandler(async (req, res) => {
  const key = req.params.key as ReportKey;
  const def = REPORT_DEFINITIONS[key];
  const q = req.query as unknown as { format: 'json' | 'csv' | 'xlsx' | 'pdf'; from?: string; to?: string };
  const rows = await runReport(key, actorOf(req), req.query as never);
  const columns: ExportColumn[] = def.columns;
  const stamp = new Date().toISOString().slice(0, 10);
  const docs = services().documents;
  if (q.format === 'csv') return sendFile(res, docs.toCsv(rows, columns), 'text/csv; charset=utf-8', `${key}-report-${stamp}.csv`);
  if (q.format === 'xlsx') return sendFile(res, await docs.toXlsx(def.title, rows, columns), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${key}-report-${stamp}.xlsx`);
  if (q.format === 'pdf') return sendFile(res, await docs.toPdfTable(def.title, `${q.from ?? 'Last 12 months'} → ${q.to ?? 'today'}`, rows, columns), 'application/pdf', `${key}-report-${stamp}.pdf`);
  sendOk(res, { title: def.title, columns, rows });
});
