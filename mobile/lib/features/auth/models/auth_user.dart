class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.permissions = const [],
  });

  final String id;
  final String email;
  final String fullName;
  final String role;
  final List<String> permissions;

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        email: j['email'] as String,
        fullName: j['fullName'] as String? ?? '',
        role: (j['role'] is Map ? j['role']['name'] : j['role']) as String? ?? 'JOB_SEEKER',
        permissions: (j['permissions'] as List?)?.cast<String>() ?? const [],
      );
}
