/// Keeps this device registered for push while someone is signed in, and reacts to messages.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/push_repository.dart';
import 'notifications_screen.dart';

final pushMessagingProvider = Provider<PushMessaging>((_) => PushMessaging());
final deviceTokenRepositoryProvider = Provider<DeviceTokenRepository>((_) => DeviceTokenRepository());

/// Watched once from the app root. Registers the FCM token on sign-in (and when Firebase rotates it),
/// refreshes the in-app list when a message arrives, and opens Notifications when one is tapped.
final pushRegistrationProvider = Provider<PushRegistration>((ref) {
  final push = PushRegistration(ref);
  ref.listen<int?>(sessionUserIdProvider, (_, userId) => userId == null ? push._signedOut() : push._signedIn(), fireImmediately: true);
  ref.onDispose(push._dispose);
  return push;
});

class PushRegistration {
  PushRegistration(this._ref);
  final Ref _ref;
  String? _token;
  final List<StreamSubscription<Object?>> _subs = [];

  PushMessaging get _messaging => _ref.read(pushMessagingProvider);
  DeviceTokenRepository get _server => _ref.read(deviceTokenRepositoryProvider);

  Future<void> _signedIn() async {
    try {
      final token = await _messaging.token();
      if (token == null) return;
      _token = token;
      await _server.register(token);
      _listen();
    } catch (e) {
      debugPrint('Push registration failed: $e');
    }
  }

  void _listen() {
    if (_subs.isNotEmpty) return;
    _subs
      ..add(_messaging.onTokenRefresh.listen((t) {
        _token = t;
        _server.register(t).catchError((Object e) => debugPrint('Token refresh failed: $e'));
      }))
      ..add(_messaging.onForegroundMessage.listen((_) => _ref.invalidate(notificationsProvider)))
      ..add(_messaging.onOpened.listen((_) {
        _ref.invalidate(notificationsProvider);
        _ref.read(routerProvider).push(AppRoutes.notifications);
      }));
  }

  /// Called before the session ends so this phone stops getting the previous user's notifications.
  Future<void> unregister() async {
    final token = _token;
    if (token == null) return;
    try {
      await _server.unregister(token);
    } catch (e) {
      debugPrint('Push unregister failed: $e');
    }
  }

  void _signedOut() {
    _token = null;
    _dispose();
  }

  void _dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
  }
}
