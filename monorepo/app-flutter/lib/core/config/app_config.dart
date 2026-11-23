/// Application configuration.
///
/// The ONLY place that reads environment variables. NEVER access dotenv.env elsewhere.
library;

import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../constants/app_constants.dart';

abstract class AppConfig {
  static late String appName;
  static late String appVersion;
  static late String apiBaseUrl;
  static late String assetBaseUrl;
  static late String appEnv;
  static late String supportPhone;
  static late String supportWhatsapp;

  /// Call once in main() after dotenv.load().
  static void initialize() {
    apiBaseUrl = _require(AppConstants.envApiBaseUrl);
    assetBaseUrl = _get(AppConstants.envAssetBaseUrl, defaultValue: Uri.parse(apiBaseUrl).origin);
    appEnv = _get(AppConstants.envAppEnv, defaultValue: 'development');
    appName = _get(AppConstants.envAppName, defaultValue: 'Local Air Solutions');
    appVersion = _get(AppConstants.envAppVersion, defaultValue: '1.0.0');
    supportPhone = _get(AppConstants.envSupportPhone, defaultValue: '');
    supportWhatsapp = _get(AppConstants.envSupportWhatsapp, defaultValue: '');
  }

  static bool get isProduction => appEnv == 'production';
  static bool get isDebug => appEnv != 'production';

  /// Resolves an uploaded file path (/uploads/...) to an absolute URL.
  static String assetUrl(String path) => path.startsWith('http') ? path : '$assetBaseUrl$path';

  static String _require(String key) {
    final value = dotenv.env[key];
    if (value == null || value.isEmpty) {
      throw Exception('Missing required environment variable: $key');
    }
    return value;
  }

  static String _get(String key, {required String defaultValue}) {
    final v = dotenv.env[key];
    return (v == null || v.isEmpty) ? defaultValue : v;
  }
}
