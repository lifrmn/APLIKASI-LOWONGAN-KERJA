import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_envelope.dart';

class Job {
  const Job({
    required this.id,
    required this.title,
    required this.companyName,
    required this.employmentType,
    required this.workType,
    this.description,
    this.requirement,
    this.responsibility,
    this.salaryMin,
    this.salaryMax,
    this.salaryVisible = false,
    this.address,
    this.deadline,
    this.status,
    this.publishedAt,
    this.skills = const [],
  });

  final String id;
  final String title;
  final String companyName;
  final String employmentType;
  final String workType;
  final String? description;
  final String? requirement;
  final String? responsibility;
  final num? salaryMin;
  final num? salaryMax;
  final bool salaryVisible;
  final String? address;
  final DateTime? deadline;
  final String? status;
  final DateTime? publishedAt;
  final List<String> skills;

  factory Job.fromJson(dynamic j) {
    final m = Map<String, dynamic>.from(j as Map);
    return Job(
      id: m['id'] as String,
      title: m['title'] as String,
      companyName: (m['company']?['companyName'] as String?) ?? '-',
      employmentType: m['employmentType'] as String? ?? 'FULL_TIME',
      workType: m['workType'] as String? ?? 'ONSITE',
      description: m['description'] as String?,
      requirement: m['requirement'] as String?,
      responsibility: m['responsibility'] as String?,
      salaryMin: m['salaryMin'] is num ? m['salaryMin'] as num : num.tryParse('${m['salaryMin']}'),
      salaryMax: m['salaryMax'] is num ? m['salaryMax'] as num : num.tryParse('${m['salaryMax']}'),
      salaryVisible: m['salaryVisible'] == true,
      address: m['address'] as String?,
      deadline: m['deadline'] == null ? null : DateTime.tryParse(m['deadline'].toString()),
      status: m['status'] as String?,
      publishedAt: m['publishedAt'] == null ? null : DateTime.tryParse(m['publishedAt'].toString()),
      skills: (m['skills'] as List? ?? [])
          .map((e) => (e['skill']?['name'] ?? e['name'] ?? '').toString())
          .where((s) => s.isNotEmpty)
          .toList(),
    );
  }
}

class JobsRepository {
  JobsRepository(this._dio);
  final Dio _dio;

  Future<ApiPage<Job>> listActive({int page = 1, int limit = 20, String? q}) async {
    final res = await _dio.get('/jobs/active', queryParameters: {
      'page': page, 'limit': limit,
      if (q != null && q.isNotEmpty) 'search': q,
    });
    return ApiPage.parse(res.data, Job.fromJson);
  }

  Future<Job> findById(String id) async {
    final res = await _dio.get('/jobs/$id');
    final body = res.data['data'] ?? res.data;
    return Job.fromJson(body);
  }
}

final jobsRepositoryProvider = Provider<JobsRepository>(
  (_) => JobsRepository(ApiClient.instance.dio),
);
