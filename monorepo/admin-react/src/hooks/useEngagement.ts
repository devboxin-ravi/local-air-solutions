/**
 * Dashboard, reports, reminders, notifications, settings, templates and audit logic for pages.
 */

import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService, reminderService, reportService, settingsService } from '@/services/engagementService';
import { downloadBlob, monthKeysBetween } from '@/lib/utils';
import type { DashboardData, IntegrationName, QueryParams, RazorpayKeyInput } from '@/types';
import { errorMessage, useAction } from './useApi';

export const useDashboard = (params: QueryParams) =>
  useQuery({ queryKey: ['dashboard', params], queryFn: () => reportService.dashboard(params), placeholderData: keepPreviousData });

/**
 * Monthly chart series padded with zero months across the selected range, so a quiet month
 * shows as zero instead of disappearing (and one busy month doesn't look like the whole trend).
 */
export const useDashboardCharts = (data: DashboardData | undefined, range: { from: string; to: string }) =>
  useMemo(() => {
    const months = monthKeysBetween(range.from, range.to);
    const revenue = new Map((data?.charts.revenue ?? []).map((r) => [r.month, r]));
    const trend = new Map((data?.charts.bookingTrend ?? []).map((r) => [r.period, r]));
    const hasRevenue = revenue.size > 0;
    const hasTrend = trend.size > 0;
    return {
      revenue: hasRevenue ? months.map((month) => revenue.get(month) ?? { month, revenue: 0, collected: 0 }) : [],
      bookingTrend: hasTrend ? months.map((period) => trend.get(period) ?? { period, total: 0, completed: 0, cancelled: 0 }) : [],
    };
  }, [data, range.from, range.to]);

export const useReport = (key: string, params: QueryParams) =>
  useQuery({ queryKey: ['report', key, params], queryFn: () => reportService.report(key, params), placeholderData: keepPreviousData });

export const useReportExport = () => async (key: string, format: 'csv' | 'xlsx' | 'pdf', params: QueryParams) => {
  try {
    const blob = await reportService.exportReport(key, format, params);
    downloadBlob(blob, `${key}-report-${new Date().toISOString().slice(0, 10)}.${format}`);
    toast.success('Export downloaded');
  } catch (e) {
    toast.error(errorMessage(e));
  }
};

export const useReminderList = (params: QueryParams) =>
  useQuery({ queryKey: ['reminders', params], queryFn: () => reminderService.list(params), placeholderData: keepPreviousData });
export const useReminderSummary = (params?: QueryParams) => useQuery({ queryKey: ['reminders', 'summary', params], queryFn: () => reminderService.summary(params) });

export function useReminderActions() {
  return {
    create: useAction((body: unknown) => reminderService.create(body), { success: 'Reminder created', invalidate: [['reminders']] }),
    update: useAction((v: { id: number; body: unknown }) => reminderService.update(v.id, v.body), { success: 'Reminder updated', invalidate: [['reminders']] }),
    whatsapp: useAction((id: number) => settingsService.whatsappLink('serviceReminder', id), { onSuccess: (r) => window.open(r.url, '_blank', 'noopener,noreferrer') }),
  };
}

export const useNotificationPage = (params: QueryParams) =>
  useQuery({ queryKey: ['notifications', 'page', params], queryFn: () => notificationService.list(params), placeholderData: keepPreviousData });
export const useMarkNotificationsRead = () => useAction((ids: number[] | 'all') => notificationService.markRead(ids), { invalidate: [['notifications']] });

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => settingsService.all() });
export const useSaveSettings = () =>
  useAction((v: { key: string; value: Record<string, unknown> }) => settingsService.update(v.key, v.value), { success: 'Settings saved', invalidate: [['settings']] });

/** Razorpay key status (never the secrets) and the admin actions on it. */
export const useRazorpayKeys = () => useQuery({ queryKey: ['settings', 'razorpay'], queryFn: () => settingsService.razorpayKeys() });
export function useRazorpayKeyActions() {
  const invalidate = [['settings']];
  return {
    save: useAction((body: RazorpayKeyInput) => settingsService.saveRazorpayKeys(body), { success: 'Razorpay keys saved', invalidate }),
    clear: useAction(() => settingsService.clearRazorpayKeys(), { success: 'Razorpay keys removed', invalidate }),
    test: useAction((body: Partial<RazorpayKeyInput>) => settingsService.testRazorpayKeys(body), { success: (r) => `Keys work — ${r.mode} mode` }),
  };
}

/** One integration's status (only fetched while its dialog is open). */
export const useIntegration = (name: IntegrationName | null) =>
  useQuery({ queryKey: ['settings', 'integration', name], queryFn: () => settingsService.integration(name as IntegrationName), enabled: !!name });
export function useIntegrationActions() {
  const invalidate = [['settings']];
  return {
    save: useAction((v: { name: IntegrationName; body: Record<string, unknown> }) => settingsService.saveIntegration(v.name, v.body), { success: 'Settings saved', invalidate }),
    clear: useAction((name: IntegrationName) => settingsService.clearIntegration(name), { success: 'Credentials removed', invalidate }),
    test: useAction((v: { name: IntegrationName; body: Record<string, unknown> }) => settingsService.testIntegration(v.name, v.body), { success: 'Connection works' }),
  };
}

/** Saves several settings sections in one go (one page showing more than one section). */
export const useSaveSettingsBatch = () =>
  useAction((items: Array<{ key: string; value: Record<string, unknown> }>) => Promise.all(items.map((i) => settingsService.update(i.key, i.value))), {
    success: 'Settings saved',
    invalidate: [['settings']],
  });

export const useTemplates = () => useQuery({ queryKey: ['templates'], queryFn: () => settingsService.templates() });
export const useUpdateTemplate = () =>
  useAction((v: { id: number; body: unknown }) => settingsService.updateTemplate(v.id, v.body), { success: 'Template saved', invalidate: [['templates']] });

export const useAuditLogs = (params: QueryParams) =>
  useQuery({ queryKey: ['audit', params], queryFn: () => settingsService.audit(params), placeholderData: keepPreviousData });
