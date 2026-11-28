/// Job screen cards for extra work done on site and additional findings.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../domain/job_entities.dart';
import 'job_providers.dart';

/// Follow-up choices (months) offered with a finding; null = no reminder.
const List<int?> _followUpChoices = [null, 1, 3, 6, 12];

class ExtraWorkCard extends ConsumerWidget {
  const ExtraWorkCard({super.key, required this.job});
  final Job job;

  Future<void> _remove(BuildContext context, WidgetRef ref, JobItem item) async {
    try {
      await ref.read(jobActionsProvider).removeExtraItem(job.id, item.id);
    } on ApiException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!job.canAddExtraWork) return const SizedBox.shrink();
    final t = Theme.of(context).textTheme;
    final extras = job.items.where((i) => i.isExtra).toList();
    return Padding(
      padding: const EdgeInsets.only(top: Space.lg),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Extra work', style: t.titleMedium),
          const SizedBox(height: Space.xs),
          Text('Anything added here is billed with this job.', style: t.bodySmall),
          for (final item in extras)
            Row(children: [
              Expanded(child: Text('${item.name} × ${item.quantity}', style: t.bodyLarge)),
              IconButton(tooltip: 'Remove ${item.name}', onPressed: () => _remove(context, ref, item), icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red)),
            ]),
          const SizedBox(height: Space.sm),
          OutlinedButton.icon(
            onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _ExtraWorkSheet(job: job)),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Add extra work'),
          ),
        ]),
      ),
    );
  }
}

class _ExtraWorkSheet extends ConsumerStatefulWidget {
  const _ExtraWorkSheet({required this.job});
  final Job job;

  @override
  ConsumerState<_ExtraWorkSheet> createState() => _ExtraWorkSheetState();
}

class _ExtraWorkSheetState extends ConsumerState<_ExtraWorkSheet> {
  final _search = TextEditingController();
  final _note = TextEditingController();

  /// serviceId → quantity
  final Map<int, int> _picked = {};
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  void _setQuantity(int id, int quantity) => setState(() => quantity <= 0 ? _picked.remove(id) : _picked[id] = quantity);

  Future<void> _save() async {
    if (_picked.isEmpty && _note.text.trim().isEmpty) {
      setState(() => _error = 'Select a service or describe the extra work.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(jobActionsProvider).addExtraWork(widget.job.id, services: _picked, note: _note.text);
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppSnack(context, 'Extra work added.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final services = ref.watch(extraServicesProvider(widget.job.branchId));
    final query = _search.text.trim().toLowerCase();
    return Padding(
      padding: EdgeInsets.fromLTRB(Space.page, Space.page, Space.page, MediaQuery.viewInsetsOf(context).bottom + Space.page),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Add extra work', style: t.titleLarge),
          const SizedBox(height: Space.sm),
          TextField(controller: _search, onChanged: (_) => setState(() {}), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Search service, e.g. gas')),
          Expanded(
            child: services.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(child: TextButton(onPressed: () => ref.invalidate(extraServicesProvider(widget.job.branchId)), child: const Text('Could not load services. Retry'))),
              data: (all) {
                final shown = all.where((s) => query.isEmpty || s.name.toLowerCase().contains(query) || s.code.toLowerCase().contains(query)).toList();
                return ListView.builder(
                  itemCount: shown.length,
                  itemBuilder: (_, i) {
                    final s = shown[i];
                    final quantity = _picked[s.id] ?? 0;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(s.name),
                      subtitle: Text(s.price > 0 ? Fmt.money(s.price) : 'Price decided by office'),
                      trailing: quantity == 0
                          ? TextButton(onPressed: () => _setQuantity(s.id, 1), child: const Text('Add'))
                          : Row(mainAxisSize: MainAxisSize.min, children: [
                              IconButton(onPressed: () => _setQuantity(s.id, quantity - 1), icon: const Icon(Icons.remove_circle_outline_rounded)),
                              Text('$quantity', style: t.titleMedium),
                              IconButton(onPressed: () => _setQuantity(s.id, quantity + 1), icon: const Icon(Icons.add_circle_outline_rounded)),
                            ]),
                    );
                  },
                );
              },
            ),
          ),
          TextField(controller: _note, maxLength: 500, minLines: 1, maxLines: 3, decoration: const InputDecoration(labelText: 'Extra work note', counterText: '')),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: Space.sm), child: Text(_error!, style: t.bodyMedium?.copyWith(color: AppColors.red))),
          const SizedBox(height: Space.sm),
          PrimaryButton(label: 'Add to job', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}

class FindingsCard extends ConsumerWidget {
  const FindingsCard({super.key, required this.job});
  final Job job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final findings = job.notes.where((n) => n.kind == 'FINDING').toList();
    if (!job.canRecordFindings && findings.isEmpty) return const SizedBox.shrink();
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: Space.lg),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Additional findings', style: t.titleMedium),
          const SizedBox(height: Space.xs),
          if (findings.isEmpty) Text('e.g. “PCB dead, customer declined repair”.', style: t.bodySmall),
          for (final f in findings)
            Padding(
              padding: const EdgeInsets.only(top: Space.sm),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(f.note, style: t.bodyLarge), Text('${f.author} · ${Fmt.dateTime(f.at)}', style: t.bodySmall)]),
            ),
          if (job.canRecordFindings) ...[
            const SizedBox(height: Space.sm),
            OutlinedButton.icon(
              onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _FindingSheet(jobId: job.id)),
              icon: const Icon(Icons.report_gmailerrorred_rounded),
              label: const Text('Record a finding'),
            ),
          ],
        ]),
      ),
    );
  }
}

class _FindingSheet extends ConsumerStatefulWidget {
  const _FindingSheet({required this.jobId});
  final int jobId;

  @override
  ConsumerState<_FindingSheet> createState() => _FindingSheetState();
}

class _FindingSheetState extends ConsumerState<_FindingSheet> {
  final _finding = TextEditingController();
  int? _months;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _finding.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_finding.text.trim().length < 3) {
      setState(() => _error = 'Describe what you found.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(jobActionsProvider).addFinding(widget.jobId, _finding.text, followUpMonths: _months);
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppSnack(context, 'Finding saved.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(Space.page, Space.page, Space.page, MediaQuery.viewInsetsOf(context).bottom + Space.page),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Record a finding', style: t.titleLarge),
        const SizedBox(height: Space.sm),
        TextField(controller: _finding, autofocus: true, maxLength: 900, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'What did you find, and what did the customer decide?')),
        const SizedBox(height: Space.sm),
        Text('Remind to follow up', style: t.titleSmall),
        Wrap(spacing: Space.sm, children: [
          for (final m in _followUpChoices) ChoiceChip(label: Text(m == null ? 'No reminder' : '$m month${m > 1 ? 's' : ''}'), selected: _months == m, onSelected: (_) => setState(() => _months = m)),
        ]),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: Space.sm), child: Text(_error!, style: t.bodyMedium?.copyWith(color: AppColors.red))),
        const SizedBox(height: Space.md),
        PrimaryButton(label: 'Save finding', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
      ]),
    );
  }
}
