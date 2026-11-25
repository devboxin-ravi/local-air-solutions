/**
 * Route definitions and guards only. Pages are lazy-loaded per module.
 */

import { lazy, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuth, bootstrapSession } from '@/hooks/useAuth';
import { AppLayout } from '@/layout/AppLayout';
import { SettingsLayout } from '@/layout/SettingsLayout';
import { useSettingsItems } from '@/hooks/useHeader';
import { LoadingBlock } from '@/components/common';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const BookingsListPage = lazy(() => import('@/pages/bookings/BookingsListPage'));
const BookingFormPage = lazy(() => import('@/pages/bookings/BookingFormPage'));
const BookingDetailPage = lazy(() => import('@/pages/bookings/BookingDetailPage'));
const CalendarPage = lazy(() => import('@/pages/bookings/CalendarPage'));
const SlotsPage = lazy(() => import('@/pages/bookings/SlotsPage'));
const ServicesListPage = lazy(() => import('@/pages/services/ServicesListPage'));
const ServiceFormPage = lazy(() => import('@/pages/services/ServiceFormPage'));
const CategoriesPage = lazy(() => import('@/pages/services/CategoriesPage'));
const PricingPage = lazy(() => import('@/pages/services/PricingPage'));
const AvailabilityPage = lazy(() => import('@/pages/services/AvailabilityPage'));
const AssignmentsPage = lazy(() => import('@/pages/assignments/AssignmentsPage'));
const AssignPage = lazy(() => import('@/pages/assignments/AssignPage'));
const TechBoardPage = lazy(() => import('@/pages/assignments/TechBoardPage'));
const CustomersListPage = lazy(() => import('@/pages/customers/CustomersListPage'));
const CustomerFormPage = lazy(() => import('@/pages/customers/CustomerFormPage'));
const CustomerDetailPage = lazy(() => import('@/pages/customers/CustomerDetailPage'));
const AddressesPage = lazy(() => import('@/pages/customers/AddressesPage'));
const LedgerPage = lazy(() => import('@/pages/customers/LedgerPage'));
const RemindersPage = lazy(() => import('@/pages/customers/RemindersPage'));
const AmcListPage = lazy(() => import('@/pages/amc/AmcListPage'));
const AmcFormPage = lazy(() => import('@/pages/amc/AmcFormPage'));
const AmcDetailPage = lazy(() => import('@/pages/amc/AmcDetailPage'));
const AmcVisitsPage = lazy(() => import('@/pages/amc/AmcVisitsPage'));
const InvoicesPage = lazy(() => import('@/pages/finance/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('@/pages/finance/InvoiceDetailPage'));
const InvoiceFormPage = lazy(() => import('@/pages/finance/InvoiceFormPage'));
const PaymentsPage = lazy(() => import('@/pages/finance/PaymentsPage'));
const OutstandingPage = lazy(() => import('@/pages/finance/OutstandingPage'));
const GstPage = lazy(() => import('@/pages/finance/GstPage'));
const ReportPage = lazy(() => import('@/pages/reports/ReportPage'));
const MasterDataPage = lazy(() => import('@/pages/master/MasterDataPage'));
const StaffPage = lazy(() => import('@/pages/master/StaffPage'));
const RolesPage = lazy(() => import('@/pages/master/RolesPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const AuditLogsPage = lazy(() => import('@/pages/settings/AuditLogsPage'));
const TemplatesPage = lazy(() => import('@/pages/settings/TemplatesPage'));
const NotificationsPage = lazy(() => import('@/pages/account/NotificationsPage'));
const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const NotFoundPage = lazy(() => import('@/pages/account/NotFoundPage'));

/** Guard: requires an authenticated admin session. */
const RequireAuth = () => {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingBlock rows={6} className="mx-auto max-w-3xl pt-24" />;
  if (status === 'anonymous') return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
};

/** Guard: requires a permission (UI only — the API enforces the same rule). */
const RequirePermission = ({ permission }: { permission: string }) => {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <Navigate to={ROUTES.DASHBOARD} replace />;
};

const GuestOnly = () => {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingBlock rows={4} className="mx-auto max-w-md pt-24" />;
  return status === 'authenticated' ? <Navigate to={ROUTES.DASHBOARD} replace /> : <Outlet />;
};

/** /settings opens the first settings section the user may access. */
const SettingsIndex = () => {
  const items = useSettingsItems();
  return <Navigate to={items[0]?.to ?? ROUTES.DASHBOARD} replace />;
};

const P = (permission: string, element: JSX.Element) => <Route element={<RequirePermission permission={permission} />}>{element}</Route>;

export const AppRoutes = () => {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          {P('dashboard.view', <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />)}

          {P('bookings.view', <>
            <Route path="/bookings" element={<BookingsListPage />} />
            <Route path="/bookings/view/:view" element={<BookingsListPage />} />
            <Route path="/bookings/calendar" element={<CalendarPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path={ROUTES.REPAIRS} element={<BookingsListPage preset="repairs" />} />
            <Route path={ROUTES.CUSTOMER_HISTORY} element={<BookingsListPage preset="history" />} />
          </>)}
          {P('bookings.create', <Route path={ROUTES.BOOKING_NEW} element={<BookingFormPage />} />)}
          {P('slots.view', <Route path={ROUTES.SLOTS} element={<SlotsPage />} />)}

          {P('services.view', <>
            <Route path={ROUTES.SERVICES} element={<ServicesListPage />} />
            <Route path={ROUTES.CATEGORIES} element={<CategoriesPage />} />
            <Route path={ROUTES.PRICING} element={<PricingPage />} />
            <Route path={ROUTES.AVAILABILITY} element={<AvailabilityPage />} />
            <Route path="/services/:id/edit" element={<ServiceFormPage />} />
          </>)}
          {P('services.create', <Route path={ROUTES.SERVICE_NEW} element={<ServiceFormPage />} />)}

          {P('assignments.view', <>
            <Route path={ROUTES.ASSIGNMENTS} element={<AssignmentsPage mode="all" />} />
            <Route path={ROUTES.JOB_TRACKING} element={<AssignmentsPage mode="tracking" />} />
            <Route path={ROUTES.COMPLETED_JOBS} element={<AssignmentsPage mode="completed" />} />
            <Route path={ROUTES.TECH_AVAILABILITY} element={<TechBoardPage mode="availability" />} />
            <Route path={ROUTES.STAFF_SCHEDULE} element={<TechBoardPage mode="schedule" />} />
          </>)}
          {P('assignments.assign', <Route path={ROUTES.ASSIGN} element={<AssignPage />} />)}

          {P('customers.view', <>
            <Route path={ROUTES.CUSTOMERS} element={<CustomersListPage />} />
            <Route path={ROUTES.CUSTOMER_ADDRESSES} element={<AddressesPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          </>)}
          {P('customers.create', <Route path={ROUTES.CUSTOMER_NEW} element={<CustomerFormPage />} />)}
          {P('ledger.view', <>
            <Route path={ROUTES.CUSTOMER_LEDGER} element={<LedgerPage />} />
            <Route path={ROUTES.FINANCE_LEDGER} element={<LedgerPage />} />
            <Route path={ROUTES.OUTSTANDING} element={<OutstandingPage />} />
          </>)}
          {P('reminders.view', <Route path={ROUTES.REMINDERS} element={<RemindersPage />} />)}

          {P('amc.view', <>
            <Route path={ROUTES.AMC} element={<AmcListPage />} />
            <Route path={ROUTES.AMC_EXPIRING} element={<AmcListPage expiring />} />
            <Route path={ROUTES.AMC_VISITS} element={<AmcVisitsPage />} />
            <Route path="/amc/:id" element={<AmcDetailPage />} />
          </>)}
          {P('amc.create', <Route path={ROUTES.AMC_NEW} element={<AmcFormPage />} />)}
          {P('reports.view', <>
            <Route path={ROUTES.AMC_REPORTS} element={<ReportPage reportKey="amc" />} />
            <Route path="/reports/:key" element={<ReportPage />} />
            <Route path={ROUTES.GST_REPORTS} element={<GstPage />} />
          </>)}

          {P('invoices.view', <>
            <Route path={ROUTES.INVOICES} element={<InvoicesPage />} />
            <Route path="/finance/invoices/:id" element={<InvoiceDetailPage />} />
          </>)}
          {P('invoices.create', <Route path={ROUTES.INVOICE_NEW} element={<InvoiceFormPage />} />)}
          {P('payments.view', <Route path={ROUTES.PAYMENTS} element={<PaymentsPage />} />)}
          {P('payments.approve', <Route path={ROUTES.PAYMENT_VERIFICATION} element={<PaymentsPage verification />} />)}

          {P('masterData.view', <Route path="/master/:resource" element={<MasterDataPage />} />)}
          {P('staff.view', <Route path={ROUTES.STAFF} element={<StaffPage />} />)}
          {P('roles.view', <Route path={ROUTES.ROLES} element={<RolesPage />} />)}

          <Route element={<SettingsLayout />}>
            <Route path={ROUTES.SETTINGS_HOME} element={<SettingsIndex />} />
            {P('auditLogs.view', <Route path={ROUTES.AUDIT_LOGS} element={<AuditLogsPage />} />)}
            {P('notifications.view', <Route path={ROUTES.TEMPLATES} element={<TemplatesPage />} />)}
            {P('settings.view', <Route path="/settings/:key" element={<SettingsPage />} />)}
          </Route>

          <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
          <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
