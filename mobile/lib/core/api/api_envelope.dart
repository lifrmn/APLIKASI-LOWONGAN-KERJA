/// Standard envelope from backend: { success, message, data }
class ApiEnvelope<T> {
  const ApiEnvelope({required this.success, required this.message, this.data, this.meta});
  final bool success;
  final String message;
  final T? data;
  final Map<String, dynamic>? meta;

  static ApiEnvelope<T> parse<T>(dynamic json, T Function(dynamic) map) {
    if (json is! Map) {
      return ApiEnvelope<T>(success: false, message: 'Invalid response', data: null);
    }
    return ApiEnvelope<T>(
      success: json['success'] == true,
      message: (json['message'] ?? '').toString(),
      data: json['data'] == null ? null : map(json['data']),
      meta: json['meta'] is Map<String, dynamic> ? json['meta'] : null,
    );
  }
}

class ApiPage<T> {
  const ApiPage({required this.data, required this.page, required this.limit, required this.total, required this.totalPages});
  final List<T> data;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  static ApiPage<T> parse<T>(dynamic body, T Function(dynamic) map) {
    final list = (body['data'] as List? ?? []).map(map).toList();
    final meta = (body['meta'] as Map?) ?? const {};
    return ApiPage<T>(
      data: list,
      page: (meta['page'] as int?) ?? 1,
      limit: (meta['limit'] as int?) ?? list.length,
      total: (meta['total'] as int?) ?? list.length,
      totalPages: (meta['totalPages'] as int?) ?? 1,
    );
  }
}
