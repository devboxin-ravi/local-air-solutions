/// Auth data access: maps API responses to domain entities and persists tokens.
library;

import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/token_storage.dart';
import '../domain/auth_entity.dart';

AppUser userFromJson(Map<String, dynamic> j) => AppUser(
      id: (j['id'] as num).toInt(),
      name: j['name'] as String,
      email: j['email'] as String?,
      mobile: j['mobile'] as String,
      userType: j['userType'] as String,
      roles: ((j['roles'] as List?) ?? const []).map((e) => '$e').toList(),
      customerId: (j['customerId'] as num?)?.toInt(),
      staffId: (j['staffId'] as num?)?.toInt(),
    );

class AuthRepository {
  AuthRepository({ApiClient? client, TokenStorage? tokens})
      : _api = client ?? ApiClient.instance,
        _tokens = tokens ?? TokenStorage.instance;

  final ApiClient _api;
  final TokenStorage _tokens;

  Future<LoginOutcome> _complete(Map<String, dynamic> data) async {
    if (data['otpRequired'] == true) return LoginNeedsOtp((data['userId'] as num).toInt());
    final tokens = data['tokens'] as Map<String, dynamic>;
    await _tokens.save(accessToken: tokens['accessToken'] as String, refreshToken: tokens['refreshToken'] as String);
    return LoginSucceeded(userFromJson(data['user'] as Map<String, dynamic>));
  }

  Future<LoginOutcome> login(String identifier, String password) async =>
      _complete(await _api.post(ApiConstants.login, body: {'identifier': identifier.trim(), 'password': password}, parse: (d) => d as Map<String, dynamic>));

  Future<LoginOutcome> verifyOtp(int userId, String code) async =>
      _complete(await _api.post(ApiConstants.otpVerify, body: {'userId': userId, 'code': code}, parse: (d) => d as Map<String, dynamic>));

  Future<LoginOutcome> register({
    required String fullName,
    required String mobile,
    String? email,
    required String password,
    Map<String, dynamic>? address,
  }) async =>
      _complete(await _api.post(
        ApiConstants.register,
        body: {'fullName': fullName.trim(), 'mobile': mobile.trim(), 'email': (email?.trim().isEmpty ?? true) ? null : email!.trim(), 'password': password, if (address != null) 'address': address},
        parse: (d) => d as Map<String, dynamic>,
      ));

  /// Restores a session from the stored refresh token; returns null when signed out.
  Future<AppUser?> restoreSession() async {
    if (await _tokens.readRefreshToken() == null) return null;
    final token = await _api.refreshAccessToken();
    if (token == null) return null;
    return me();
  }

  Future<AppUser> me() => _api.get(ApiConstants.me, parse: (d) => userFromJson(d as Map<String, dynamic>));

  Future<void> logout() async {
    final rt = await _tokens.readRefreshToken();
    try {
      await _api.post(ApiConstants.logout, body: {'refreshToken': rt}, parse: (_) {});
    } catch (_) {
      // Logging out locally must always succeed.
    } finally {
      await _tokens.clear();
      await _clearUserCache();
    }
  }

  /// Drops cached per-user data (technician job lists / dashboard) so the next account
  /// never sees it offline. Device-level data such as favourites is kept.
  Future<void> _clearUserCache() async {
    if (!Hive.isBoxOpen(AppConstants.hiveBoxCache)) return;
    final box = Hive.box<String>(AppConstants.hiveBoxCache);
    final keys = box.keys.where((k) => k is String && (k.startsWith(AppConstants.cacheTechJobsPrefix) || k == AppConstants.cacheTechDashboard)).toList();
    await box.deleteAll(keys);
  }

  Future<String> forgotPassword(String identifier) => _api.post(ApiConstants.forgotPassword, body: {'identifier': identifier.trim()}, parse: (d) => (d as Map)['message'] as String);

  Future<String> resetPassword(String identifier, String code, String newPassword) =>
      _api.post(ApiConstants.resetPassword, body: {'identifier': identifier.trim(), 'code': code, 'newPassword': newPassword}, parse: (d) => (d as Map)['message'] as String);

  Future<void> changePassword(String current, String next) => _api.post(ApiConstants.changePassword, body: {'currentPassword': current, 'newPassword': next}, parse: (_) {});

  Future<bool> onboardingDone() => _tokens.readFlag('las_onboarding_done');
  Future<void> setOnboardingDone() => _tokens.writeFlag('las_onboarding_done', true);

  /// Current profile picture path (relative to the asset base), or null.
  Future<String?> avatarPath() => _api.get(ApiConstants.me, parse: (d) => (d as Map)['avatarUrl'] as String?);

  /// Uploads a new profile picture; returns its stored path.
  Future<String?> uploadAvatar(String filePath) =>
      _api.upload(ApiConstants.meAvatar, field: ApiConstants.avatarField, files: [filePath], parse: (d) => (d as Map)['avatarUrl'] as String?);

  Future<void> removeAvatar() => _api.delete(ApiConstants.meAvatar);
}
