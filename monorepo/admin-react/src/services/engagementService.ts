/**
 * Dashboard, reports, search, reminders, notifications, settings, audit and share API calls.
 */

import { API } from '@/constants/api';
import type { AppNotification, AuditLog, DashboardData, IntegrationName, IntegrationStatus, QueryParams, RazorpayKeyInput, RazorpayKeyStatus, Reminder, ReportResult, SearchResults, ShareLink, Template } from '@/types';
import { http } from './apiClient';

export const reportService = {
  dashboard: (params?: QueryParams) => http.get<DashboardData>(API.DASHBOARD, params),
  search: (q: string, branchId?: number) => http.get<SearchResults>(API.SEARCH, { q, branchId }),
  report: (key: string, params?: QueryParams) => http.get<ReportResult>(API.REPORT(key), params),
  exportReport: (key: string, format: 'csv' | 'xlsx' | 'pdf', params?: QueryParams) => http.blob(API.REPORT(key), { ...params, format }),
};

export const reminderService = {
  list: (params?: QueryParams) => http.page<Reminder>(API.REMINDERS, params),
  summary: (params?: QueryParams) => http.get<{ upcoming: number; dueToday: number; overdue: number; completed: number }>(API.REMINDER_SUMMARY, params),
  create: (body: unknown) => http.post<Reminder>(API.REMINDERS, body),
  update: (id: number, body: unknown) => http.patch<Reminder>(API.REMINDER(id), body),
};

export const notificationService = {
  list: (params?: QueryParams) => http.page<AppNotification>(API.NOTIFICATIONS, params),
  markRead: (ids: number[] | 'all') => http.post<{ updated: number }>(API.NOTIFICATIONS_READ, { ids }),
};

export const settingsService = {
  all: () => http.get<Record<string, Record<string, unknown>> & { integrations: Record<string, boolean> }>(API.SETTINGS),
  update: (key: string, value: Record<string, unknown>) => http.put<Record<string, unknown>>(API.SETTING(key), value),
  templates: () => http.get<Template[]>(API.TEMPLATES),
  updateTemplate: (id: number, body: unknown) => http.patch<Template>(API.TEMPLATE(id), body),
  audit: (params?: QueryParams) => http.page<AuditLog>(API.AUDIT_LOGS, params),
  razorpayKeys: () => http.get<RazorpayKeyStatus>(API.RAZORPAY_KEYS),
  saveRazorpayKeys: (body: RazorpayKeyInput) => http.put<RazorpayKeyStatus>(API.RAZORPAY_KEYS, body),
  clearRazorpayKeys: () => http.del(API.RAZORPAY_KEYS),
  testRazorpayKeys: (body: Partial<RazorpayKeyInput>) => http.post<{ ok: boolean; mode: 'test' | 'live' }>(API.RAZORPAY_KEYS_TEST, body),
  integration: (name: IntegrationName) => http.get<IntegrationStatus>(API.INTEGRATION(name)),
  saveIntegration: (name: IntegrationName, body: Record<string, unknown>) => http.put<IntegrationStatus>(API.INTEGRATION(name), body),
  clearIntegration: (name: IntegrationName) => http.del(API.INTEGRATION(name)),
  testIntegration: (name: IntegrationName, body: Record<string, unknown>) => http.post<{ ok: boolean }>(API.INTEGRATION_TEST(name), body),
  whatsappLink: (type: 'booking' | 'assignment' | 'invoice' | 'paymentReminder' | 'serviceReminder', id: number) => http.get<ShareLink>(API.SHARE_WHATSAPP, { type, id }),
};
