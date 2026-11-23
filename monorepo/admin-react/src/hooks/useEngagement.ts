/**
 * Dashboard, reports, reminders, notifications, settings, templates and audit logic for pages.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService, reminderService, reportService, settingsService } from '@/services/engagementService';
import { downloadBlob } from '@/lib/utils';
import type { QueryParams } from '@/types';
import { errorMessage, useAction } from './useApi';

export const useDashboard = (params: QueryParams) =>
  useQuery({ queryKey: ['dashboard', params], queryFn: () => reportService.dashboard(params), placeholderData: keepPreviousData });

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

export const useTemplates = () => useQuery({ queryKey: ['templates'], queryFn: () => settingsService.templates() });
export const useUpdateTemplate = () =>
  useAction((v: { id: number; body: unknown }) => settingsService.updateTemplate(v.id, v.body), { success: 'Template saved', invalidate: [['templates']] });

export const useAuditLogs = (params: QueryParams) =>
  useQuery({ queryKey: ['audit', params], queryFn: () => settingsService.audit(params), placeholderData: keepPreviousData });
