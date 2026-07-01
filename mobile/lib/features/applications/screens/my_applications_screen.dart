import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../data/applications_repository.dart';

class MyApplicationsScreen extends ConsumerStatefulWidget {
  const MyApplicationsScreen({super.key});
  @override
  ConsumerState<MyApplicationsScreen> createState() => _MyApplicationsScreenState();
}

class _MyApplicationsScreenState extends ConsumerState<MyApplicationsScreen> {
  Future<List<ApplicationSummary>>? _future;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  void _refresh() {
    setState(() {
      _future = ref.read(applicationsRepositoryProvider).my().then((p) => p.data);
    });
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy · HH:mm', 'id_ID');
    return Scaffold(
      appBar: AppBar(title: const Text('Lamaran Saya')),
      body: RefreshIndicator(
        onRefresh: () async => _refresh(),
        child: FutureBuilder<List<ApplicationSummary>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) return Center(child: Text('Gagal memuat: ${snap.error}'));
            final list = snap.data ?? const <ApplicationSummary>[];
            if (list.isEmpty) return const Center(child: Text('Belum ada lamaran'));
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final a = list[i];
                return Card(
                  child: ListTile(
                    title: Text(a.jobTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 2),
                        Text(a.companyName),
                        Text(df.format(a.appliedAt), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      ],
                    ),
                    trailing: _StatusChip(status: a.status),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final map = {
      'APPLIED': Colors.blue,
      'REVIEWED': Colors.indigo,
      'SHORTLISTED': Colors.deepPurple,
      'INTERVIEW': Colors.orange,
      'ACCEPTED': Colors.green,
      'REJECTED': Colors.red,
      'CANCELLED': Colors.grey,
    };
    final c = map[status] ?? Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.withOpacity(0.5)),
      ),
      child: Text(status, style: TextStyle(fontSize: 11, color: c, fontWeight: FontWeight.w600)),
    );
  }
}
