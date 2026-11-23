/**
 * Composition root: the ONLY place that constructs repositories and wires services.
 */

import { prisma } from '../repositories/db';
import { AuthRepository } from '../repositories/authRepository';
import { UserRepository } from '../repositories/userRepository';
import { MasterDataRepository } from '../repositories/masterDataRepository';
import { CatalogRepository } from '../repositories/catalogRepository';
import { CustomerRepository } from '../repositories/customerRepository';
import { StaffRepository } from '../repositories/staffRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { SlotRepository } from '../repositories/slotRepository';
import { FinanceRepository } from '../repositories/financeRepository';
import { AmcRepository } from '../repositories/amcRepository';
import { EngagementRepository } from '../repositories/engagementRepository';
import { ReportRepository } from '../repositories/reportRepository';
import { SettingsService } from '../services/settingsService';
import { EmailProvider, PushProvider, WhatsAppCloudProvider } from '../services/deliveryProviders';
import { NotificationService } from '../services/notificationService';
import { AuthService } from '../services/authService';
import { MasterDataService } from '../services/masterDataService';
import { CatalogService } from '../services/catalogService';
import { CustomerService } from '../services/customerService';
import { StaffService } from '../services/staffService';
import { SlotService } from '../services/slotService';
import { BookingService } from '../services/bookingService';
import { ReminderService } from '../services/reminderService';
import { AssignmentService } from '../services/assignmentService';
import { LedgerService } from '../services/ledgerService';
import { InvoiceService } from '../services/invoiceService';
import { PaymentService } from '../services/paymentService';
import { AmcService } from '../services/amcService';
import { ReportService } from '../services/reportService';
import { DocumentService } from '../services/documentService';
import { ShareService } from '../services/shareService';

export function buildContainer() {
  const repos = {
    auth: new AuthRepository(),
    users: new UserRepository(),
    master: new MasterDataRepository(),
    catalog: new CatalogRepository(),
    customers: new CustomerRepository(),
    staff: new StaffRepository(),
    bookings: new BookingRepository(),
    slots: new SlotRepository(),
    finance: new FinanceRepository(),
    amc: new AmcRepository(),
    engagement: new EngagementRepository(),
    reports: new ReportRepository(),
  };

  const email = new EmailProvider();
  const push = new PushProvider();
  const whatsapp = new WhatsAppCloudProvider();

  const settings = new SettingsService(repos.engagement);
  const notifications = new NotificationService(repos.engagement, settings, email, push, whatsapp);
  const customers = new CustomerService(repos.customers, repos.master, settings);
  const auth = new AuthService(repos.auth, repos.users, repos.customers, settings, email, customers);
  const masterData = new MasterDataService(repos.master, settings);
  const catalog = new CatalogService(repos.catalog, settings);
  const staff = new StaffService(repos.staff, repos.users, auth, settings);
  const slots = new SlotService(repos.slots, settings);
  const bookings = new BookingService(repos.bookings, repos.customers, repos.users, catalog, slots, notifications, settings);
  const reminders = new ReminderService(repos.engagement, repos.bookings, notifications, settings);
  const assignments = new AssignmentService(repos.bookings, repos.staff, bookings, catalog, reminders, notifications, settings);
  const ledger = new LedgerService(repos.finance, repos.customers, settings);
  const invoices = new InvoiceService(repos.finance, repos.bookings, repos.customers, repos.master, ledger, notifications, settings);
  const amc = new AmcService(repos.amc, repos.customers, repos.bookings, invoices, bookings, assignments, notifications, settings);
  const payments = new PaymentService(repos.finance, repos.bookings, repos.customers, repos.amc, invoices, ledger, bookings, amc, notifications, settings);
  const reports = new ReportService(repos.reports);
  const documents = new DocumentService();
  const share = new ShareService(bookings, invoices, documents, email, settings, repos.engagement, repos.users);

  return {
    settings,
    notifications,
    auth,
    masterData,
    catalog,
    customers,
    staff,
    slots,
    bookings,
    reminders,
    assignments,
    ledger,
    invoices,
    payments,
    amc,
    reports,
    documents,
    share,
  };
}

export type Container = ReturnType<typeof buildContainer>;

/** Closes the database connection pool (graceful shutdown). */
export const disconnectDatabase = (): Promise<void> => prisma.$disconnect();
