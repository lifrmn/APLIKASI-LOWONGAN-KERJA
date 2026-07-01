import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_envelope.dart';

class ApplicationSummary {
  const ApplicationSummary({
    required this.id,
    required this.status,
    required this.appliedAt,
    required this.jobTitle,
    required this.companyName,
  });
  final String id;
  final String status;
  final DateTime appliedAt;
  final String jobTitle;
  final String companyName;

  factory ApplicationSummary.fromJson(dynamic j) {
    final m = Map<String, dynamic>.from(j as Map);
    return ApplicationSummary(
      id: m['id'] as String,
      status: m['status'] as String,
      appliedAt: DateTime.tryParse('${m['appliedAt']}') ?? DateTime.now(),
      jobTitle: (m['job']?['title'] as String?) ?? '-',
      companyName: (m['job']?['company']?['companyName'] as String?) ?? '-',
    );
  }
}

class ApplicationsRepository {
  ApplicationsRepository(this._dio);
  final Dio _dio;

  Future<void> apply({
    required String jobId,
    String? coverLetter,
    String? cvFileId,
  }) async {
    await _dio.post('/applications', data: {
      'jobId': jobId,
      if (coverLetter != null && coverLetter.isNotEmpty) 'coverLetter': coverLetter,
      if (cvFileId != null) 'cvFileId': cvFileId,
    });
  }

  Future<ApiPage<ApplicationSummary>> my({int page = 1, int limit = 20}) async {
    final res = await _dio.get('/applications/my-applications',
        queryParameters: {'page': page, 'limit': limit});
    return ApiPage.parse(res.data, ApplicationSummary.fromJson);
  }
}

final applicationsRepositoryProvider = Provider<ApplicationsRepository>(
  (_) => ApplicationsRepository(ApiClient.instance.dio),
);
