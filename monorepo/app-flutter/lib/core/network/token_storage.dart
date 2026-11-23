/// Token storage: access token in memory, refresh token in platform secure storage.
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

class TokenStorage {
  TokenStorage._();
  static final TokenStorage instance = TokenStorage._();

  final FlutterSecureStorage _secure = const FlutterSecureStorage();
  String? _accessToken;

  String? get accessToken => _accessToken;

  Future<void> save({required String accessToken, required String refreshToken}) async {
    _accessToken = accessToken;
    await _secure.write(key: AppConstants.storageRefreshToken, value: refreshToken);
  }

  Future<String?> readRefreshToken() => _secure.read(key: AppConstants.storageRefreshToken);

  Future<void> clear() async {
    _accessToken = null;
    await _secure.delete(key: AppConstants.storageRefreshToken);
  }

  Future<bool> readFlag(String key) async => (await _secure.read(key: key)) == 'true';
  Future<void> writeFlag(String key, bool value) => _secure.write(key: key, value: value.toString());
}
