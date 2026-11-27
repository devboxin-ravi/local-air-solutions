/// Auth state providers (Riverpod). Delegates to AuthRepository.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';

import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../domain/auth_entity.dart';
import '../../notifications/presentation/push_providers.dart';

final authRepositoryProvider = Provider<AuthRepository>((_) => AuthRepository());

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _expiredSub;

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _expiredSub = ApiClient.instance.onSessionExpired.listen((_) => state = AuthState.signedOut);
    ref.onDispose(() => _expiredSub?.cancel());
    Future.microtask(_restore);
    return AuthState.unknown;
  }

  Future<void> _restore() async {
    try {
      final user = await _repo.restoreSession();
      state = user == null ? AuthState.signedOut : AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      state = AuthState.signedOut;
    }
  }

  Future<void> _apply(LoginOutcome outcome) async {
    state = switch (outcome) {
      LoginSucceeded(:final user) => AuthState(status: AuthStatus.authenticated, user: user),
      LoginNeedsOtp(:final userId) => AuthState(status: AuthStatus.otpRequired, pendingUserId: userId),
    };
  }

  Future<void> login(String identifier, String password) async => _apply(await _repo.login(identifier, password));

  Future<void> verifyOtp(String code) async {
    final id = state.pendingUserId;
    if (id == null) return;
    await _apply(await _repo.verifyOtp(id, code));
  }

  Future<void> register({required String fullName, required String mobile, String? email, required String password, Map<String, dynamic>? address}) async =>
      _apply(await _repo.register(fullName: fullName, mobile: mobile, email: email, password: password, address: address));

  Future<void> logout() async {
    await ref.read(pushRegistrationProvider).unregister();
    await _repo.logout();
    state = AuthState.signedOut;
  }

  void cancelOtp() => state = AuthState.signedOut;
}

final onboardingDoneProvider = FutureProvider<bool>((ref) => ref.read(authRepositoryProvider).onboardingDone());

/// Id of the signed-in user (null when signed out). Every per-user provider watches this, so
/// logging out or switching accounts refetches its data instead of showing the previous user's.
final sessionUserIdProvider = Provider<int?>((ref) => ref.watch(authControllerProvider.select((s) => s.user?.id)));

/// Signed-in user's profile picture URL (null when none is set).
final avatarProvider = FutureProvider<String?>((ref) async {
  if (ref.watch(sessionUserIdProvider) == null) return null;
  final path = await ref.read(authRepositoryProvider).avatarPath();
  return path == null || path.isEmpty ? null : AppConfig.assetUrl(path);
});
