import 'package:flutter_dotenv/flutter_dotenv.dart';

class Env {
  static Future<void> load() async {
    await dotenv.load(fileName: '.env');
  }

  static String get apiBaseUrl =>
      dotenv.get('API_BASE_URL', fallback: 'http://10.0.2.2:3000/api/v1');

  static String get appEnv => dotenv.get('APP_ENV', fallback: 'development');

  static String get supportEmail =>
      dotenv.get('SUPPORT_EMAIL', fallback: 'support@sulbarkerja.id');

  static String get privacyPolicyUrl =>
      dotenv.get('PRIVACY_POLICY_URL', fallback: 'https://sulbarkerja.id/legal/privacy');
}
