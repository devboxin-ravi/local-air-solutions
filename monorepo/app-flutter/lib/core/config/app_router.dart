/// Application router — route definitions and auth/role guards only.
/// Customers get the customer app; technicians get the field app (one codebase, separate navigation).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/presentation/profile_screens.dart';
import '../../features/assignments/presentation/job_detail_screen.dart';
import '../../features/assignments/presentation/tech_screens.dart';
import '../../features/auth/domain/auth_entity.dart';
import '../../features/auth/presentation/auth_provider.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/onboarding_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/bookings/domain/booking_entities.dart';
import '../../features/bookings/presentation/book_flow_screen.dart';
import '../../features/bookings/presentation/bookings_screens.dart';
import '../../features/catalog/presentation/services_screen.dart';
import '../../features/finance/presentation/finance_screens.dart';
import '../../features/home/presentation/app_shells.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../constants/app_constants.dart';

const _publicRoutes = {AppRoutes.login, AppRoutes.register, AppRoutes.forgotPassword, AppRoutes.onboarding};

/// Bridges Riverpod auth state to GoRouter's refreshListenable.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (_, __) => notifyListeners());
    ref.listen(onboardingDoneProvider, (_, __) => notifyListeners());
  }
}

int _id(GoRouterState s) => int.tryParse(s.pathParameters['id'] ?? '') ?? 0;

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);
  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      if (auth.status == AuthStatus.unknown) return loc == AppRoutes.splash ? null : AppRoutes.splash;

      if (auth.status != AuthStatus.authenticated) {
        if (_publicRoutes.contains(loc)) return null;
        final onboarded = ref.read(onboardingDoneProvider).value ?? true;
        return onboarded ? AppRoutes.login : AppRoutes.onboarding;
      }

      final isTech = auth.user!.isTechnician;
      final inTech = loc.startsWith('/tech');
      if (loc == AppRoutes.splash || _publicRoutes.contains(loc)) return isTech ? AppRoutes.techDashboard : AppRoutes.home;
      if (isTech && !inTech) return AppRoutes.techDashboard;
      if (!isTech && inTech) return AppRoutes.home;
      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: AppRoutes.onboarding, builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(path: AppRoutes.forgotPassword, builder: (_, __) => const ForgotPasswordScreen()),

      // ─── Customer app ───
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => CustomerShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.home, builder: (_, __) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.services, builder: (_, __) => const ServicesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.bookings, builder: (_, __) => const BookingsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.amc, builder: (_, __) => const AmcScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.profile, builder: (_, __) => const ProfileScreen())]),
        ],
      ),
      GoRoute(path: AppRoutes.categoryServices, builder: (_, s) => CategoryServicesScreen(categoryId: _id(s), title: s.extra as String?)),
      GoRoute(path: AppRoutes.serviceDetail, builder: (_, s) => ServiceDetailScreen(serviceId: _id(s))),
      GoRoute(path: AppRoutes.bookService, builder: (_, __) => const BookFlowScreen()),
      GoRoute(path: AppRoutes.repairRequest, builder: (_, __) => const BookFlowScreen()),
      GoRoute(path: AppRoutes.bookingSuccess, builder: (_, s) => BookingSuccessScreen(booking: s.extra as BookingSummary?)),
      GoRoute(path: AppRoutes.bookingDetail, builder: (_, s) => BookingDetailScreen(bookingId: _id(s))),
      GoRoute(path: AppRoutes.payment, builder: (_, s) => PaymentScreen(args: s.extra! as PaymentArgs)),
      GoRoute(path: AppRoutes.amcDetail, builder: (_, s) => AmcDetailScreen(amcId: _id(s))),
      GoRoute(path: AppRoutes.addresses, builder: (_, __) => const AddressesScreen()),
      GoRoute(path: AppRoutes.invoices, builder: (_, __) => const InvoicesScreen()),
      GoRoute(path: AppRoutes.invoiceDetail, builder: (_, s) => InvoiceDetailScreen(invoiceId: _id(s))),
      GoRoute(path: AppRoutes.payments, builder: (_, __) => const PaymentsScreen()),
      GoRoute(path: AppRoutes.reminders, builder: (_, __) => const RemindersScreen()),
      GoRoute(path: AppRoutes.support, builder: (_, __) => const SupportScreen()),
      GoRoute(path: AppRoutes.notifications, builder: (_, __) => const NotificationsScreen()),

      // ─── Technician app ───
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => TechnicianShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.techDashboard, builder: (_, __) => const TechDashboardScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.techJobs, builder: (_, __) => const TechJobsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.techHistory, builder: (_, __) => const TechJobsScreen(history: true))]),
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.techProfile, builder: (_, __) => const TechProfileScreen())]),
        ],
      ),
      GoRoute(path: AppRoutes.techJobDetail, builder: (_, s) => JobDetailScreen(jobId: _id(s))),
      GoRoute(path: AppRoutes.techNotifications, builder: (_, __) => const NotificationsScreen()),
    ],
  );
});
