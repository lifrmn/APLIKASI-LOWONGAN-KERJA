import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../data/jobs_repository.dart';
import 'job_detail_screen.dart';

class JobsListScreen extends ConsumerStatefulWidget {
  const JobsListScreen({super.key});
  @override
  ConsumerState<JobsListScreen> createState() => _JobsListScreenState();
}

class _JobsListScreenState extends ConsumerState<JobsListScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  final List<Job> _items = [];
  int _page = 1;
  bool _loading = false;
  bool _end = false;
  String _q = '';

  @override
  void initState() {
    super.initState();
    _fetch(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300 && !_loading && !_end) {
        _fetch();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _fetch({bool reset = false}) async {
    if (_loading) return;
    setState(() => _loading = true);
    if (reset) {
      _page = 1;
      _end = false;
      _items.clear();
    }
    try {
      final repo = ref.read(jobsRepositoryProvider);
      final r = await repo.listActive(page: _page, limit: 20, q: _q.isEmpty ? null : _q);
      setState(() {
        _items.addAll(r.data);
        _end = _page >= r.totalPages;
        _page++;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal memuat: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    return Scaffold(
      appBar: AppBar(title: const Text('Lowongan Aktif')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Cari lowongan…',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () {
                    _q = _search.text.trim();
                    _fetch(reset: true);
                  },
                ),
              ),
              onSubmitted: (v) {
                _q = v.trim();
                _fetch(reset: true);
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _fetch(reset: true),
              child: ListView.separated(
                controller: _scroll,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  if (i == _items.length) {
                    if (_loading) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
                    if (_end && _items.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Tidak ada lowongan')));
                    return const SizedBox(height: 24);
                  }
                  final job = _items[i];
                  final salary = (job.salaryVisible && job.salaryMin != null)
                      ? '${fmt.format(job.salaryMin)}${job.salaryMax != null ? ' - ${fmt.format(job.salaryMax)}' : ''}'
                      : 'Gaji tidak ditampilkan';
                  return Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(12),
                      title: Text(job.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(job.companyName),
                          const SizedBox(height: 4),
                          Text('${job.employmentType} · ${job.workType}',
                              style: const TextStyle(fontSize: 12, color: Colors.black54)),
                          const SizedBox(height: 4),
                          Text(salary, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                        ],
                      ),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => JobDetailScreen(jobId: job.id)),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
