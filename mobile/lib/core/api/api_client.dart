import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../env.dart';
import '../storage/token_storage.dart';

/// Global singleton HTTP client.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  late final TokenStorage _storage =
      TokenStorage(const FlutterSecureStorage());

  late final Dio dio = _build();

  bool _refreshing = false;

  Dio _build() {
    final d = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
        validateStatus: (s) => s != null && s < 500,
      ),
    );

    d.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.accessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          if (response.statusCode == 401 &&
              response.requestOptions.extra['skipRefresh'] != true) {
            final ok = await _tryRefresh();
            if (ok) {
              final retried = await _retry(response.requestOptions);
              return handler.resolve(retried);
            }
            await _storage.clear();
          }
          handler.next(response);
        },
      ),
    );

    if (Env.appEnv != 'production') {
      d.interceptors.add(
        PrettyDioLogger(
          requestHeader: false,
          requestBody: true,
          responseHeader: false,
          responseBody: true,
          error: true,
          compact: true,
          maxWidth: 100,
        ),
      );
    }

    return d;
  }

  Future<bool> _tryRefresh() async {
    if (_refreshing) return false;
    _refreshing = true;
    try {
      final refresh = await _storage.refreshToken();
      if (refresh == null || refresh.isEmpty) return false;

      final res = await Dio(BaseOptions(baseUrl: Env.apiBaseUrl)).post(
        '/auth/refresh-token',
        data: {'refreshToken': refresh},
      );
      final data = res.data is Map ? res.data['data'] ?? res.data : {};
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (newAccess == null) return false;
      await _storage.save(accessToken: newAccess, refreshToken: newRefresh);
      return true;
    } catch (_) {
      return false;
    } finally {
      _refreshing = false;
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions o) async {
    final token = await _storage.accessToken();
    final opts = Options(
      method: o.method,
      headers: {
        ...o.headers,
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );
    return dio.request(
      o.path,
      data: o.data,
      queryParameters: o.queryParameters,
      options: opts,
    );
  }
}
