import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/auth_user.dart';

class AuthState {
  const AuthState({this.user, this.loading = false});
  final AuthUser? user;
  final bool loading;

  AuthState copyWith({AuthUser? user, bool? loading, bool clearUser = false}) => AuthState(
        user: clearUser ? null : (user ?? this.user),
        loading: loading ?? this.loading,
      );
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._dio, this._storage) : super(const AuthState());

  final Dio _dio;
  final TokenStorage _storage;

  Future<void> restore() async {
    final token = await _storage.accessToken();
    if (token == null) return;
    state = state.copyWith(loading: true);
    try {
      final r = await _dio.get('/auth/me');
      if (r.statusCode == 200 && r.data is Map) {
        final body = r.data as Map;
        final data = body['data'] ?? body;
        state = state.copyWith(user: AuthUser.fromJson(Map<String, dynamic>.from(data)), loading: false);
        return;
      }
    } catch (_) {
      // ignore
    }
    state = state.copyWith(loading: false, clearUser: true);
  }

  Future<AuthUser?> login(String email, String password) async {
    state = state.copyWith(loading: true);
    try {
      final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
      if (res.statusCode != 200 && res.statusCode != 201) {
        throw _asMessage(res.data) ?? 'Login gagal';
      }
      final body = res.data['data'] ?? res.data;
      await _storage.save(
        accessToken: body['accessToken'] as String,
        refreshToken: body['refreshToken'] as String?,
      );
      final user = AuthUser.fromJson(Map<String, dynamic>.from(body['user'] as Map));
      state = state.copyWith(user: user, loading: false);
      return user;
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    state = state.copyWith(loading: true);
    try {
      final res = await _dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'fullName': fullName,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      });
      if (res.statusCode != 200 && res.statusCode != 201) {
        throw _asMessage(res.data) ?? 'Registrasi gagal';
      }
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {}
    await _storage.clear();
    state = state.copyWith(clearUser: true);
  }

  String? _asMessage(dynamic data) {
    if (data is Map && data['message'] is String) return data['message'] as String;
    return null;
  }
}

final tokenStorageProvider = Provider<TokenStorage>(
  (_) => TokenStorage(const FlutterSecureStorage()),
);

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ApiClient.instance.dio, ref.read(tokenStorageProvider));
});
