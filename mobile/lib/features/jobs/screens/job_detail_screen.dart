import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../data/jobs_repository.dart';
import '../../applications/screens/apply_job_screen.dart';

class JobDetailScreen extends ConsumerStatefulWidget {
  const JobDetailScreen({super.key, required this.jobId});
  final String jobId;

  @override
  ConsumerState<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends ConsumerState<JobDetailScreen> {
  Future<Job>? _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(jobsRepositoryProvider).findById(widget.jobId);
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    return Scaffold(
      appBar: AppBar(title: const Text('Detail Lowongan')),
      body: FutureBuilder<Job>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || !snap.hasData) {
            return Center(child: Text('Gagal memuat: ${snap.error ?? '-'}'));
          }
          final j = snap.data!;
          final salary = (j.salaryVisible && j.salaryMin != null)
              ? '${fmt.format(j.salaryMin)}${j.salaryMax != null ? ' - ${fmt.format(j.salaryMax)}' : ''}'
              : 'Gaji tidak ditampilkan';
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(j.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(j.companyName, style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 12),
              Wrap(spacing: 8, children: [
                Chip(label: Text(j.employmentType)),
                Chip(label: Text(j.workType)),
              ]),
              const SizedBox(height: 8),
              _row(Icons.attach_money, salary),
              if (j.address != null) _row(Icons.location_on_outlined, j.address!),
              if (j.deadline != null)
                _row(Icons.event, 'Deadline: ${DateFormat('d MMM yyyy', 'id_ID').format(j.deadline!)}'),
              const Divider(height: 32),
              if (j.description != null) _section('Deskripsi', j.description!),
              if (j.responsibility != null) _section('Tanggung Jawab', j.responsibility!),
              if (j.requirement != null) _section('Persyaratan', j.requirement!),
              if (j.skills.isNotEmpty) ...[
                const Text('Skill', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: j.skills.map((s) => Chip(label: Text(s))).toList()),
                const SizedBox(height: 16),
              ],
              FilledButton.icon(
                icon: const Icon(Icons.send),
                label: const Text('Lamar Sekarang'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => ApplyJobScreen(jobId: j.id, jobTitle: j.title)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Icon(icon, size: 18, color: Colors.black54),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ]),
    );
  }

  Widget _section(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );
  }
}
