/// Auth state providers (Riverpod). Delegates to AuthRepository.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../domain/auth_entity.dart';

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
    await _repo.logout();
    state = AuthState.signedOut;
  }

  void cancelOtp() => state = AuthState.signedOut;
}

final onboardingDoneProvider = FutureProvider<bool>((ref) => ref.read(authRepositoryProvider).onboardingDone());
