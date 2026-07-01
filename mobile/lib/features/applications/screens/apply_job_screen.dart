import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/applications_repository.dart';
import '../../files/data/files_repository.dart';

class ApplyJobScreen extends ConsumerStatefulWidget {
  const ApplyJobScreen({super.key, required this.jobId, required this.jobTitle});
  final String jobId;
  final String jobTitle;

  @override
  ConsumerState<ApplyJobScreen> createState() => _ApplyJobScreenState();
}

class _ApplyJobScreenState extends ConsumerState<ApplyJobScreen> {
  final _coverLetter = TextEditingController();
  String? _cvFileId;
  String? _cvFilename;
  bool _busy = false;

  @override
  void dispose() {
    _coverLetter.dispose();
    super.dispose();
  }

  Future<void> _pickCv() async {
    final res = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'doc', 'docx'],
      withData: false,
    );
    if (res == null || res.files.single.path == null) return;
    setState(() => _busy = true);
    try {
      final path = res.files.single.path!;
      final id = await ref.read(filesRepositoryProvider).uploadCv(path, filename: res.files.single.name);
      setState(() {
        _cvFileId = id;
        _cvFilename = res.files.single.name;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CV berhasil diunggah')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload gagal: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ref.read(applicationsRepositoryProvider).apply(
            jobId: widget.jobId,
            coverLetter: _coverLetter.text.trim(),
            cvFileId: _cvFileId,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lamaran terkirim')));
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal melamar: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lamar Pekerjaan')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Melamar untuk: ${widget.jobTitle}',
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          TextField(
            controller: _coverLetter,
            maxLines: 6,
            maxLength: 2000,
            decoration: const InputDecoration(
              labelText: 'Cover letter (opsional)',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.description_outlined),
              title: Text(_cvFilename ?? 'Belum ada CV terpasang'),
              subtitle: const Text('PDF / DOC / DOCX'),
              trailing: TextButton.icon(
                icon: const Icon(Icons.upload_file),
                label: Text(_cvFileId == null ? 'Unggah' : 'Ganti'),
                onPressed: _busy ? null : _pickCv,
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Mengirim…' : 'Kirim Lamaran'),
          ),
        ],
      ),
    );
  }
}
