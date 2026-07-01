import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

class FilesRepository {
  FilesRepository(this._dio);
  final Dio _dio;

  /// Upload CV (multipart). Returns fileId dari backend.
  Future<String> uploadCv(String filePath, {String? filename}) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: filename),
    });
    final res = await _dio.post('/files/upload-cv',
        data: form, options: Options(contentType: 'multipart/form-data'));
    final body = res.data['data'] ?? res.data;
    return body['id'] as String;
  }
}

final filesRepositoryProvider = Provider<FilesRepository>(
  (_) => FilesRepository(ApiClient.instance.dio),
);
