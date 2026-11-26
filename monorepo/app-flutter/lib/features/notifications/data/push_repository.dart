/// Push notifications: this device's FCM token on the server, and the Firebase Messaging SDK.
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

/// Server side: which devices receive this user's push notifications.
class DeviceTokenRepository {
  DeviceTokenRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<void> register(String token) => _api.post(ApiConstants.devices, body: {'token': token, 'platform': _platform}, parse: (_) {});

  /// Must run while still signed in (the endpoint needs the session).
  Future<void> unregister(String token) => _api.delete(ApiConstants.devices, body: {'token': token});

  static String get _platform => kIsWeb ? 'web' : (Platform.isIOS ? 'ios' : 'android');
}

/// Device side: Firebase Messaging. Every call is a no-op when Firebase isn't available
/// (e.g. tests or a build without google-services.json), so the app never fails because of push.
class PushMessaging {
  bool _ready = false;

  Future<bool> _ensure() async {
    if (_ready) return true;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      _ready = true;
    } catch (e) {
      debugPrint('Push disabled: $e');
    }
    return _ready;
  }

  /// Asks for notification permission (Android 13+ / iOS) and returns this device's token.
  Future<String?> token() async {
    if (!await _ensure()) return null;
    final settings = await FirebaseMessaging.instance.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return null;
    // The backend sends via FCM HTTP v1 `message.token`, which needs the registration token.
    // register()/onRegistered return a Firebase Installation ID instead, so keep getToken for now.
    // ignore: deprecated_member_use
    return FirebaseMessaging.instance.getToken();
  }

  Stream<String> get onTokenRefresh async* {
    // ignore: deprecated_member_use
    if (await _ensure()) yield* FirebaseMessaging.instance.onTokenRefresh;
  }

  /// Messages that arrive while the app is open (the system tray only shows them when it's closed).
  Stream<RemoteMessage> get onForegroundMessage async* {
    if (await _ensure()) yield* FirebaseMessaging.onMessage;
  }

  /// The user tapped a notification: the one that launched the app, then any later taps.
  Stream<RemoteMessage> get onOpened async* {
    if (!await _ensure()) return;
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) yield initial;
    yield* FirebaseMessaging.onMessageOpenedApp;
  }
}
