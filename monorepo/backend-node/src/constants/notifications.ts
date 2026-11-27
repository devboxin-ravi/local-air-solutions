/**
 * Default notification templates (seeded into notification_templates; editable in admin).
 * Placeholders use {{name}} syntax.
 */

import { NotificationEvents } from './domain';

export interface TemplateDefinition {
  eventType: string;
  title: string;
  body: string;
}

/** Shown in place of {{slot}} when a booking has no time slot yet. */
export const SLOT_TO_BE_CONFIRMED = 'time to be confirmed';

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  { eventType: NotificationEvents.BOOKING_CREATED, title: 'Booking received', body: 'Your booking {{bookingNumber}} for {{date}} has been received. We will confirm shortly.' },
  { eventType: NotificationEvents.BOOKING_CONFIRMED, title: 'Booking confirmed', body: 'Booking {{bookingNumber}} is confirmed for {{date}} ({{slot}}).' },
  { eventType: NotificationEvents.PAYMENT_RECEIVED, title: 'Payment received', body: 'We received ₹{{amount}} (ref {{reference}}). Thank you!' },
  { eventType: NotificationEvents.PAYMENT_REJECTED, title: 'Payment could not be verified', body: 'Your payment ref {{reference}} could not be verified. Reason: {{note}}' },
  { eventType: NotificationEvents.TECHNICIAN_ASSIGNED, title: 'Technician assigned', body: '{{technicianName}} has been assigned to booking {{bookingNumber}}.' },
  { eventType: NotificationEvents.ASSIGNMENT_ACCEPTED, title: 'Technician accepted', body: '{{technicianName}} accepted booking {{bookingNumber}}.' },
  { eventType: NotificationEvents.ON_THE_WAY, title: 'Technician on the way', body: '{{technicianName}} is on the way for booking {{bookingNumber}}.' },
  { eventType: NotificationEvents.ARRIVED, title: 'Technician arrived', body: '{{technicianName}} has arrived at your location.' },
  { eventType: NotificationEvents.WORK_STARTED, title: 'Work started', body: 'Work has started on booking {{bookingNumber}}.' },
  { eventType: NotificationEvents.SERVICE_COMPLETED, title: 'Service completed', body: 'Booking {{bookingNumber}} has been completed. Thank you for choosing Local Air Solutions!' },
  { eventType: NotificationEvents.INVOICE_GENERATED, title: 'Invoice generated', body: 'Invoice {{invoiceNumber}} of ₹{{amount}} has been generated.' },
  { eventType: NotificationEvents.PAYMENT_PENDING, title: 'Payment pending', body: '₹{{amount}} is pending on invoice {{invoiceNumber}}.' },
  { eventType: NotificationEvents.AMC_EXPIRING, title: 'AMC expiring soon', body: 'Your AMC {{amcNumber}} expires on {{date}}. Renew to stay covered.' },
  { eventType: NotificationEvents.SERVICE_DUE, title: 'Service due', body: 'Your {{serviceName}} is due on {{date}}. Book now to keep your AC running efficiently.' },
  { eventType: NotificationEvents.NEW_JOB, title: 'New job assigned', body: 'Booking {{bookingNumber}} on {{date}} at {{area}} has been assigned to you.' },
];
