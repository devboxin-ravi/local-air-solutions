/**
 * Top-header navigation definition. Items are hidden when the user lacks the permission
 * (the backend enforces the same permissions independently).
 */

import {
  AppWindow,
  BarChart3,
  Briefcase,
  Bell,
  BellRing,
  Building2,
  CalendarCheck2,
  ClipboardList,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  ListChecks,
  LayoutDashboard,
  MessagesSquare,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from './routes';
import { SETTING_SECTIONS } from './ui';

export interface NavChild {
  label: string;
  to: string;
  permission?: string;
  description?: string;
  /** Used by card-style hubs (e.g. the Settings page). */
  icon?: LucideIcon;
  group?: string;
}

/** Section headings on the Settings page, in display order. */
export const SETTINGS_GROUPS = ['Business', 'Billing & Payments', 'Communication', 'Customer App', 'Security'] as const;

/** Icon shown beside each settings group heading. */
export const SETTINGS_GROUP_ICONS: Record<(typeof SETTINGS_GROUPS)[number], LucideIcon> = {
  Business: Briefcase,
  'Billing & Payments': Wallet,
  Communication: MessagesSquare,
  'Customer App': AppWindow,
  Security: ShieldCheck,
};

/** Labels of the settings sidebar collapse toggle. */
export const SETTINGS_SIDEBAR = {
  TITLE: 'Settings',
  COLLAPSE: 'Collapse sidebar',
  EXPAND: 'Expand sidebar',
} as const;

const section = (key: string, icon: LucideIcon, group: (typeof SETTINGS_GROUPS)[number]): NavChild => ({
  label: SETTING_SECTIONS[key].title,
  description: SETTING_SECTIONS[key].description,
  to: ROUTES.SETTINGS(key),
  icon,
  group,
});

export interface NavModule {
  key: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  basePath: string;
  children: NavChild[];
}

export const NAVIGATION: NavModule[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    basePath: ROUTES.DASHBOARD,
    children: [{ label: 'Overview', to: ROUTES.DASHBOARD, description: 'KPIs, trends and pending actions' }],
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: CalendarCheck2,
    permission: 'bookings.view',
    basePath: '/bookings',
    children: [
      { label: 'All Bookings', to: ROUTES.BOOKINGS },
      { label: 'New Booking', to: ROUTES.BOOKING_NEW, permission: 'bookings.create' },
      { label: 'Pending Bookings', to: ROUTES.BOOKINGS_VIEW('pending') },
      { label: 'Confirmed Bookings', to: ROUTES.BOOKINGS_VIEW('confirmed') },
      { label: 'Completed Bookings', to: ROUTES.BOOKINGS_VIEW('completed') },
      { label: 'Cancelled Bookings', to: ROUTES.BOOKINGS_VIEW('cancelled') },
      { label: 'Service Calendar', to: ROUTES.BOOKING_CALENDAR },
      { label: 'Slot Management', to: ROUTES.SLOTS, permission: 'slots.view' },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    icon: Wrench,
    permission: 'services.view',
    basePath: '/services',
    children: [
      { label: 'All Services', to: ROUTES.SERVICES },
      { label: 'Add Service', to: ROUTES.SERVICE_NEW, permission: 'services.create' },
      { label: 'Service Categories', to: ROUTES.CATEGORIES },
      { label: 'Service Pricing', to: ROUTES.PRICING },
      { label: 'Repairing Management', to: ROUTES.REPAIRS, permission: 'bookings.view' },
      { label: 'Service Availability', to: ROUTES.AVAILABILITY },
    ],
  },
  {
    key: 'assignments',
    label: 'Assignments',
    icon: ClipboardList,
    permission: 'assignments.view',
    basePath: '/assignments',
    children: [
      { label: 'All Assignments', to: ROUTES.ASSIGNMENTS },
      { label: 'Assign Technician', to: ROUTES.ASSIGN, permission: 'assignments.assign' },
      { label: 'Technician Availability', to: ROUTES.TECH_AVAILABILITY },
      { label: 'Staff Schedule', to: ROUTES.STAFF_SCHEDULE },
      { label: 'Job Tracking', to: ROUTES.JOB_TRACKING },
      { label: 'Completed Jobs', to: ROUTES.COMPLETED_JOBS },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: Users,
    permission: 'customers.view',
    basePath: '/customers',
    children: [
      { label: 'All Customers', to: ROUTES.CUSTOMERS },
      { label: 'Add Customer', to: ROUTES.CUSTOMER_NEW, permission: 'customers.create' },
      { label: 'Customer Addresses', to: ROUTES.CUSTOMER_ADDRESSES },
      { label: 'Customer Service History', to: ROUTES.CUSTOMER_HISTORY, permission: 'bookings.view' },
      { label: 'Customer Ledger', to: ROUTES.CUSTOMER_LEDGER, permission: 'ledger.view' },
      { label: 'Service Reminders', to: ROUTES.REMINDERS, permission: 'reminders.view' },
    ],
  },
  {
    key: 'amc',
    label: 'AMC',
    icon: ShieldCheck,
    permission: 'amc.view',
    basePath: '/amc',
    children: [
      { label: 'All AMC Contracts', to: ROUTES.AMC },
      { label: 'Create AMC', to: ROUTES.AMC_NEW, permission: 'amc.create' },
      { label: 'AMC Visits', to: ROUTES.AMC_VISITS },
      { label: 'Expiring AMC', to: ROUTES.AMC_EXPIRING },
      { label: 'AMC Reports', to: ROUTES.AMC_REPORTS, permission: 'reports.view' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: FileSpreadsheet,
    permission: 'invoices.view',
    basePath: '/finance',
    children: [
      { label: 'Invoices', to: ROUTES.INVOICES },
      { label: 'Payment In', to: ROUTES.PAYMENTS, permission: 'payments.view' },
      { label: 'Payment Verification', to: ROUTES.PAYMENT_VERIFICATION, permission: 'payments.approve' },
      { label: 'Customer Ledger', to: ROUTES.FINANCE_LEDGER, permission: 'ledger.view' },
      { label: 'Outstanding Payments', to: ROUTES.OUTSTANDING, permission: 'ledger.view' },
      { label: 'GST Reports', to: ROUTES.GST_REPORTS, permission: 'reports.view' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart3,
    permission: 'reports.view',
    basePath: '/reports',
    children: [
      { label: 'Booking Reports', to: ROUTES.REPORT('bookings') },
      { label: 'Revenue Reports', to: ROUTES.REPORT('revenue') },
      { label: 'Service Reports', to: ROUTES.REPORT('services') },
      { label: 'Staff Performance', to: ROUTES.REPORT('staff') },
      { label: 'Branch Performance', to: ROUTES.REPORT('branches') },
      { label: 'Customer Reports', to: ROUTES.REPORT('customers') },
      { label: 'AMC Reports', to: ROUTES.REPORT('amc') },
    ],
  },
  {
    key: 'master',
    label: 'Master Data',
    icon: Building2,
    permission: 'masterData.view',
    basePath: '/master',
    children: [
      { label: 'States', to: ROUTES.STATES },
      { label: 'Cities', to: ROUTES.CITIES },
      { label: 'Branches', to: ROUTES.BRANCHES },
      { label: 'Service Areas', to: ROUTES.SERVICE_AREAS },
      { label: 'Staff Skills & Products', to: ROUTES.SKILLS_PRODUCTS },
      { label: 'Stock Item', to: ROUTES.STOCK },
      { label: 'Staff Management', to: ROUTES.STAFF, permission: 'staff.view' },
      { label: 'Roles & Permissions', to: ROUTES.ROLES, permission: 'roles.view' },
    ],
  },
];

/** Settings live in the profile menu (top-right), not the module bar. */
export const SETTINGS_MENU: NavModule = {
  key: 'settings',
  label: 'Settings',
  icon: Settings,
  permission: 'settings.view',
  basePath: '/settings',
  children: [
    section('company', Building2, 'Business'),
    section('general', SlidersHorizontal, 'Business'),
    section('workingHours', Clock, 'Business'),
    section('gst', Percent, 'Billing & Payments'),
    section('payment', CreditCard, 'Billing & Payments'),
    section('notification', Bell, 'Communication'),
    section('reminder', BellRing, 'Communication'),
    {
      label: 'Notification Templates',
      description: 'Wording of messages sent for each booking and payment event.',
      to: ROUTES.TEMPLATES,
      permission: 'notifications.view',
      icon: FileText,
      group: 'Communication',
    },
    section('appHome', Smartphone, 'Customer App'),
    section('bookingTracker', ListChecks, 'Customer App'),
    {
      label: 'Audit Logs',
      description: 'Trail of logins and changes made by staff.',
      to: ROUTES.AUDIT_LOGS,
      permission: 'auditLogs.view',
      icon: ScrollText,
      group: 'Security',
    },
  ],
};
