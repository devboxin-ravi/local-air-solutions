// Customer tab screens must render (never throw / grey-screen) while data is loading, when the
// server is unreachable, and when the account has no data yet.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:app_flutter/core/config/app_config.dart';
import 'package:app_flutter/features/account/domain/account_entities.dart';
import 'package:app_flutter/features/account/presentation/account_providers.dart';
import 'package:app_flutter/features/auth/domain/auth_entity.dart';
import 'package:app_flutter/features/auth/presentation/auth_provider.dart';
import 'package:app_flutter/features/bookings/presentation/booking_providers.dart';
import 'package:app_flutter/features/bookings/presentation/bookings_screens.dart';
import 'package:app_flutter/features/catalog/presentation/catalog_providers.dart';
import 'package:app_flutter/features/catalog/presentation/services_screen.dart';
import 'package:app_flutter/features/finance/presentation/finance_providers.dart';
import 'package:app_flutter/features/finance/presentation/finance_screens.dart';
import 'package:app_flutter/features/home/presentation/home_screen.dart';
import 'package:app_flutter/features/notifications/presentation/notifications_screen.dart';
import 'package:app_flutter/shared/themes/app_theme.dart';

enum Mode { loading, error, empty }

class _SignedIn extends AuthController {
  @override
  AuthState build() => const AuthState(
        status: AuthStatus.authenticated,
        user: AppUser(id: 1, name: 'Test Customer', mobile: '9000000005', userType: 'CUSTOMER', roles: ['CUSTOMER'], customerId: 1),
      );
}

Future<T> _value<T>(Mode m, T empty) => switch (m) {
      Mode.loading => Completer<T>().future,
      Mode.error => Future<T>.error(Exception('Can’t reach the server.')),
      Mode.empty => Future.value(empty),
    };

List<Override> _overrides(Mode m) => [
      authControllerProvider.overrideWith(_SignedIn.new),
      addressesProvider.overrideWith((_) => _value(m, const [])),
      homeSummaryProvider.overrideWith((_) => _value(m, const HomeSummary(upcoming: [], reminders: [], amcCount: 0, outstanding: 0))),
      categoriesProvider.overrideWith((_) => _value(m, const [])),
      popularServicesProvider.overrideWith((_) => _value(m, const [])),
      allServicesProvider.overrideWith((_) => _value(m, const [])),
      notificationsProvider.overrideWith((_) => _value(m, const [])),
      myBookingsProvider.overrideWith((_, __) => _value(m, const [])),
      amcListProvider.overrideWith((_) => _value(m, const [])),
    ];

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    dotenv.loadFromString(envString: 'API_BASE_URL=http://127.0.0.1:9/api/v1\nASSET_BASE_URL=http://127.0.0.1:9\nAPP_ENV=test\nAPP_NAME=Test\nAPP_VERSION=1.0.0\nSUPPORT_PHONE=\nSUPPORT_WHATSAPP=');
    AppConfig.initialize();
  });

  final screens = <String, Widget Function()>{
    'Home': () => const HomeScreen(),
    'Services': () => const ServicesScreen(),
    'Bookings': () => const BookingsScreen(),
    'AMC': () => const AmcScreen(),
  };

  for (final entry in screens.entries) {
    for (final mode in Mode.values) {
      testWidgets('${entry.key} renders without errors when ${mode.name}', (tester) async {
        await tester.binding.setSurfaceSize(const Size(412, 915));
        final errors = <FlutterErrorDetails>[];
        final previous = FlutterError.onError;
        FlutterError.onError = errors.add;
        try {
          await tester.pumpWidget(ProviderScope(
            overrides: _overrides(mode),
            child: MaterialApp(theme: AppTheme.light, home: entry.value()),
          ));
          await tester.pump(const Duration(milliseconds: 50));
          await tester.pump(const Duration(milliseconds: 50));
        } finally {
          FlutterError.onError = previous;
        }
        final relevant = errors.where((e) => !'${e.exception}'.contains('GoogleFonts') && !'${e.exception}'.contains('google_fonts')).toList();
        // Full diagnostics (incl. the error-causing widget) for the first failure, to make fixes obvious.
        if (relevant.isNotEmpty) FlutterError.dumpErrorToConsole(relevant.first, forceReport: true);
        expect(relevant.map((e) => '${e.exceptionAsString().split('\n').first} @ ${e.context}').toList(), isEmpty);
      });
    }
  }
}
