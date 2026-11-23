/**
 * Background jobs (node-cron): reminder status/notifications, AMC expiry, notification delivery.
 * Each job is guarded against overlapping runs; all processing is idempotent.
 */

import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config';
import { services } from '../dependencies/dependencies';
import { logger } from '../utils/logger';

const tasks: ScheduledTask[] = [];
const running = new Set<string>();

const guarded = (name: string, fn: () => Promise<unknown>) => async () => {
  if (running.has(name)) return;
  running.add(name);
  const started = Date.now();
  try {
    const result = await fn();
    logger.info('job done', { job: name, ms: Date.now() - started, result: result as Record<string, unknown> });
  } catch (err) {
    logger.error('job failed', { job: name, error: (err as Error).message });
  } finally {
    running.delete(name);
  }
};

export const dailyMaintenance = async () => {
  const s = services();
  await s.reminders.refreshStatuses();
  await s.amc.refreshStatuses();
  const notified = await s.reminders.sendDueNotifications();
  return { remindersNotified: notified };
};

export function startJobs(): void {
  tasks.push(cron.schedule(config.jobs.reminderCron, guarded('daily-maintenance', dailyMaintenance)));
  tasks.push(cron.schedule(config.jobs.notificationCron, guarded('notification-delivery', () => services().notifications.processPendingDeliveries())));
  // Run maintenance once at boot so statuses are fresh after downtime.
  void guarded('daily-maintenance', dailyMaintenance)();
  logger.info('Background jobs scheduled', { reminderCron: config.jobs.reminderCron, notificationCron: config.jobs.notificationCron });
}

export function stopJobs(): void {
  tasks.forEach((t) => t.stop());
  tasks.length = 0;
}
