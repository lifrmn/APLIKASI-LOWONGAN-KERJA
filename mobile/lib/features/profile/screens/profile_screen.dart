import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';

import '../../auth/providers/auth_provider.dart';
import '../../files/data/files_repository.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _uploading = false;

  Future<void> _uploadCv() async {
    final res = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'doc', 'docx'],
    );
    if (res == null || res.files.single.path == null) return;
    setState(() => _uploading = true);
    try {
      await ref.read(filesRepositoryProvider)
          .uploadCv(res.files.single.path!, filename: res.files.single.name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('CV berhasil diunggah')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload gagal: $e')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _logout() async {
    await ref.read(authProvider.notifier).logout();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profil Saya')),
      body: user == null
          ? const Center(child: Text('Sesi berakhir'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 28,
                          child: Text(
                            user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?',
                            style: const TextStyle(fontSize: 22),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(user.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                        Text(user.email, style: const TextStyle(color: Colors.black54)),
                        const SizedBox(height: 4),
                        Text('Role: ${user.role}', style: const TextStyle(fontSize: 12, color: Colors.black45)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.upload_file),
                        title: const Text('Unggah / Perbarui CV'),
                        subtitle: const Text('PDF / DOC / DOCX'),
                        trailing: _uploading
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.chevron_right),
                        onTap: _uploading ? null : _uploadCv,
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.privacy_tip_outlined),
                        title: const Text('Kebijakan Privasi'),
                        onTap: () {
                          // TODO: buka URL kebijakan lewat url_launcher
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.tonalIcon(
                  icon: const Icon(Icons.logout),
                  label: const Text('Keluar'),
                  onPressed: _logout,
                ),
              ],
            ),
    );
  }
}
