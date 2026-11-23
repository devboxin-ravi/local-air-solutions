/// Network API client — ALL HTTP requests go through here.
///
/// - Injects the bearer access token
/// - Rotates the refresh token once on 401 (single-flight) and retries
/// - Unwraps the backend `{ success, data, meta }` envelope
/// - Normalises errors into [ApiException]
library;

import 'dart:async';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../constants/api_constants.dart';
import '../constants/app_constants.dart';
import '../utils/logger.dart';
import 'token_storage.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode = 0, this.code = 'ERROR', this.fieldErrors = const {}});

  final String message;
  final int statusCode;
  final String code;
  final Map<String, String> fieldErrors;

  bool get isNetwork => statusCode == 0;
  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

class PagedResult<T> {
  PagedResult({required this.items, required this.page, required this.totalPages, required this.total});
  final List<T> items;
  final int page;
  final int totalPages;
  final int total;
  bool get hasMore => page < totalPages;
}

class ApiClient {
  ApiClient._() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
        receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
        sendTimeout: const Duration(milliseconds: ApiConstants.sendTimeout),
        headers: {'Content-Type': 'application/json'},
      ),
    );
    _dio.interceptors.add(_AuthInterceptor(this));
    if (AppConfig.isDebug) _dio.interceptors.add(_LoggingInterceptor());
  }

  static final ApiClient instance = ApiClient._();
  late final Dio _dio;

  final _sessionExpired = StreamController<void>.broadcast();

  /// Emits when the refresh token is no longer valid (user must sign in again).
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  Completer<String?>? _refreshing;

  /// Single-flight refresh: concurrent 401s share one refresh call.
  Future<String?> refreshAccessToken() async {
    if (_refreshing != null) return _refreshing!.future;
    final completer = Completer<String?>();
    _refreshing = completer;
    try {
      final rt = await TokenStorage.instance.readRefreshToken();
      if (rt == null) {
        completer.complete(null);
      } else {
        final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl)).post<Map<String, dynamic>>(ApiConstants.refresh, data: {'refreshToken': rt});
        final data = res.data!['data'] as Map<String, dynamic>;
        await TokenStorage.instance.save(accessToken: data['accessToken'] as String, refreshToken: data['refreshToken'] as String);
        completer.complete(data['accessToken'] as String);
      }
    } catch (_) {
      await TokenStorage.instance.clear();
      completer.complete(null);
    } finally {
      _refreshing = null;
    }
    return completer.future;
  }

  void _emitExpired() => _sessionExpired.add(null);

  Future<T> _wrap<T>(Future<Response<dynamic>> Function() call, T Function(dynamic data, Map<String, dynamic>? meta) map) async {
    try {
      final res = await call();
      final body = res.data;
      if (body is Map<String, dynamic>) return map(body['data'], body['meta'] as Map<String, dynamic>?);
      return map(body, null);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final res = e.response;
    if (res == null) return ApiException(Messages.networkError);
    final body = res.data;
    if (body is Map<String, dynamic> && body['error'] is Map<String, dynamic>) {
      final err = body['error'] as Map<String, dynamic>;
      final details = <String, String>{};
      if (err['details'] is Map) (err['details'] as Map).forEach((k, v) => details['$k'] = '$v');
      return ApiException(err['message'] as String? ?? Messages.genericError, statusCode: res.statusCode ?? 0, code: err['code'] as String? ?? 'ERROR', fieldErrors: details);
    }
    return ApiException(Messages.genericError, statusCode: res.statusCode ?? 0);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query, required T Function(dynamic data) parse}) =>
      _wrap(() => _dio.get<dynamic>(path, queryParameters: _clean(query)), (d, _) => parse(d));

  Future<PagedResult<T>> getPage<T>(String path, {Map<String, dynamic>? query, required T Function(Map<String, dynamic> json) item}) => _wrap(
        () => _dio.get<dynamic>(path, queryParameters: _clean(query)),
        (d, meta) => PagedResult<T>(
          items: (d as List).map((e) => item(e as Map<String, dynamic>)).toList(),
          page: (meta?['page'] as num?)?.toInt() ?? 1,
          totalPages: (meta?['totalPages'] as num?)?.toInt() ?? 1,
          total: (meta?['total'] as num?)?.toInt() ?? (d).length,
        ),
      );

  Future<T> post<T>(String path, {Object? body, Map<String, String>? headers, required T Function(dynamic data) parse}) =>
      _wrap(() => _dio.post<dynamic>(path, data: body, options: Options(headers: headers)), (d, _) => parse(d));

  Future<T> patch<T>(String path, {Object? body, required T Function(dynamic data) parse}) =>
      _wrap(() => _dio.patch<dynamic>(path, data: body), (d, _) => parse(d));

  Future<void> delete(String path) => _wrap(() => _dio.delete<dynamic>(path), (_, __) {});

  /// Multipart upload. [files] are local file paths; [field] is the form field name.
  Future<T> upload<T>(String path, {required String field, required List<String> files, Map<String, String> fields = const {}, Map<String, String>? headers, required T Function(dynamic data) parse}) async {
    final form = FormData.fromMap(fields);
    for (final f in files) {
      form.files.add(MapEntry(field, await MultipartFile.fromFile(f, filename: f.split(RegExp(r'[\\/]')).last)));
    }
    return _wrap(() => _dio.post<dynamic>(path, data: form, options: Options(headers: headers)), (d, _) => parse(d));
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? q) => q == null ? null : (Map.of(q)..removeWhere((_, v) => v == null || v == ''));
}

class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor(this._client);
  final ApiClient _client;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = TokenStorage.instance.accessToken;
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isAuthCall = err.requestOptions.path.startsWith('/auth/');
    final retried = err.requestOptions.extra['retried'] == true;
    if (err.response?.statusCode == 401 && !isAuthCall && !retried) {
      final token = await _client.refreshAccessToken();
      if (token != null) {
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer $token'
          ..extra['retried'] = true;
        try {
          final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl)).fetch<dynamic>(opts);
          return handler.resolve(res);
        } on DioException catch (e) {
          return handler.next(e);
        }
      }
      _client._emitExpired();
    }
    handler.next(err);
  }
}

class _LoggingInterceptor extends Interceptor {
  final _log = const Logger('Network');

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _log.debug('→ ${options.method} ${options.path}');
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    _log.debug('← ${response.statusCode} ${response.requestOptions.path}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _log.warn('✕ ${err.response?.statusCode} ${err.requestOptions.path}');
    handler.next(err);
  }
}
