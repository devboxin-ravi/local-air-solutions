/// Job details & field workflow: accept/reject → on the way → arrived → start →
/// notes & before/after photos → complete (with customer OTP when configured).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/launcher.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../bookings/presentation/booking_widgets.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../domain/job_entities.dart';
import 'job_providers.dart';
import 'tech_screens.dart';

class JobDetailScreen extends ConsumerStatefulWidget {
  const JobDetailScreen({super.key, required this.jobId});
  final int jobId;
  @override
  ConsumerState<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends ConsumerState<JobDetailScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted && success != null) showAppSnack(context, success);
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.isNetwork ? '${e.message} Your action was not saved — retry when online.' : e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  JobActions get _actions => ref.read(jobActionsProvider);

  /// Icon for each field-workflow button.
  static const Map<JobAction, IconData> _actionIcons = {
    JobAction.respond: Icons.check_rounded,
    JobAction.onTheWay: Icons.two_wheeler_rounded,
    JobAction.arrived: Icons.home_work_rounded,
    JobAction.start: Icons.handyman_rounded,
    JobAction.complete: Icons.task_alt_rounded,
  };

  /// Status card: the same stepper the customer sees, plus what to tap next.
  Widget _statusCard(BuildContext context, Job job) {
    final action = job.nextAction;
    final t = Theme.of(context).textTheme;
    final hint = switch (action) {
      JobAction.respond => 'Accept the job to start tracking.',
      null => job.status == BookingStatus.completed ? 'Job completed — great work!' : 'No action needed right now.',
      _ => 'Next, tap “${action.label}” below — the customer is updated instantly.',
    };
    return AppCard(
      padding: const EdgeInsets.all(Space.lg),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.timeline_rounded, size: 20, color: AppColors.blue),
          const SizedBox(width: Space.sm),
          Expanded(child: Text('Job status', style: t.titleMedium)),
          StatusBadge(job.status),
        ]),
        const SizedBox(height: Space.lg),
        TrackingTimeline(status: job.status, events: const [], config: ref.watch(publicSettingsProvider).value?.trackerSteps ?? const []),
        const SizedBox(height: Space.md),
        Row(children: [
          Icon(action == null ? Icons.check_circle_rounded : _actionIcons[action], size: 16, color: action == null ? AppColors.greenDark : AppColors.slate),
          const SizedBox(width: 6),
          Expanded(child: Text(hint, style: t.bodySmall)),
        ]),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(jobProvider(widget.jobId));
    return Scaffold(
      appBar: AppBar(title: const Text('Job details')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(jobProvider(widget.jobId).future),
        child: AsyncBody<Job>(value: value, onRetry: () => ref.invalidate(jobProvider(widget.jobId)), data: (job) => _body(context, job)),
      ),
      bottomNavigationBar: value.maybeWhen(data: (job) => _actionBar(context, job), orElse: () => null),
    );
  }

  Widget _body(BuildContext context, Job job) {
    final t = Theme.of(context).textTheme;
    final canEdit = BookingStatus.active.contains(job.status) && job.status != BookingStatus.assigned;
    return ListView(padding: const EdgeInsets.all(Space.page), children: [
      Row(children: [Expanded(child: Text(job.number, style: t.bodySmall?.copyWith(fontWeight: FontWeight.w700))), StatusBadge(job.status, large: true)]),
      const SizedBox(height: Space.sm),
      Text(job.title, style: t.headlineSmall),
      const SizedBox(height: Space.xs),
      Text('${Fmt.dateOnly(job.scheduledDate)}${job.scheduledTime != null ? ' · ${job.scheduledTime}' : ''}${job.productName != null ? ' · ${job.productName}' : ''}', style: t.bodyMedium),
      const SizedBox(height: Space.lg),
      _statusCard(context, job),
      const SizedBox(height: Space.lg),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(job.customerName, style: t.titleMedium),
          const SizedBox(height: Space.xs),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.location_on_rounded, color: AppColors.green, size: 20), const SizedBox(width: 6), Expanded(child: Text(job.address, style: t.bodyLarge))]),
          if (!job.hasCoordinates) Padding(padding: const EdgeInsets.only(top: 6), child: Text('No pinned location — navigation searches the address.', style: t.bodySmall?.copyWith(color: AppColors.amber))),
          const SizedBox(height: Space.lg),
          Row(children: [
            Expanded(child: OutlinedButton.icon(onPressed: () => Launcher.call(job.customerPhone), icon: const Icon(Icons.call_rounded), label: const Text('Call'))),
            const SizedBox(width: Space.sm),
            Expanded(child: FilledButton.icon(onPressed: () => openJobDirections(job), icon: const Icon(Icons.navigation_rounded), label: const Text('Navigate'))),
          ]),
        ]),
      ),
      if (job.problemDescription != null || job.instructions != null) ...[
        const SizedBox(height: Space.lg),
        AppCard(
          color: AppColors.amberSoft,
          border: false,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (job.problemDescription != null) ...[Text('Reported problem', style: t.titleSmall), Text(job.problemDescription!, style: t.bodyLarge)],
            if (job.instructions != null) ...[const SizedBox(height: Space.sm), Text('Instructions', style: t.titleSmall), Text(job.instructions!, style: t.bodyLarge)],
          ]),
        ),
      ],
      const SizedBox(height: Space.lg),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Services', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          if (job.items.isEmpty) Text('Repair — services to be decided on inspection.', style: t.bodyMedium),
          ...job.items.map((i) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Icon(i.isPerformed ? Icons.check_circle : Icons.circle_outlined, size: 20, color: i.isPerformed ? AppColors.green : AppColors.slateLight), const SizedBox(width: Space.sm), Expanded(child: Text('${i.name} × ${i.quantity}', style: t.bodyLarge))]))),
        ]),
      ),
      const SizedBox(height: Space.lg),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Photos', style: t.titleMedium)),
            if (canEdit) ...[
              TextButton.icon(onPressed: _busy ? null : () => _pickPhotos(job, 'BEFORE'), icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Before')),
              TextButton.icon(onPressed: _busy ? null : () => _pickPhotos(job, 'AFTER'), icon: const Icon(Icons.add_a_photo_outlined), label: const Text('After')),
            ],
          ]),
          if (job.photos.isEmpty) Text('No photos yet.', style: t.bodyMedium),
          if (job.photos.isNotEmpty)
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: job.photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: Space.sm),
                itemBuilder: (_, i) => Stack(children: [
                  ClipRRect(borderRadius: BorderRadius.circular(Radii.md), child: Image.network(AppConfig.assetUrl(job.photos[i].path), width: 96, height: 96, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 96, color: AppColors.border))),
                  Positioned(left: 4, top: 4, child: StatusBadge(job.photos[i].kind)),
                ]),
              ),
            ),
        ]),
      ),
      const SizedBox(height: Space.lg),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('Service notes', style: t.titleMedium)), if (canEdit) TextButton.icon(onPressed: _busy ? null : () => _addNote(job), icon: const Icon(Icons.note_add_outlined), label: const Text('Add note'))]),
          if (job.notes.isEmpty) Text('No notes yet.', style: t.bodyMedium),
          ...job.notes.map((n) => Padding(
                padding: const EdgeInsets.only(top: Space.sm),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(n.note, style: t.bodyLarge), Text('${n.author} · ${Fmt.dateTime(n.at)}', style: t.bodySmall)]),
              )),
        ]),
      ),
      const SizedBox(height: Space.xxl),
    ]);
  }

  Widget? _actionBar(BuildContext context, Job job) {
    final action = job.nextAction;
    if (action == null) return null;
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(Space.page),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.border))),
        child: action == JobAction.respond
            ? Row(children: [
                Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _reject(job), style: OutlinedButton.styleFrom(foregroundColor: AppColors.red), child: const Text('Reject'))),
                const SizedBox(width: Space.md),
                Expanded(flex: 2, child: PrimaryButton(label: 'Accept job', icon: _actionIcons[JobAction.respond], loading: _busy, color: AppColors.greenDark, onPressed: () => _run(() => _actions.respond(job.id, true), success: 'Job accepted'))),
              ])
            : action == JobAction.complete
                ? PrimaryButton(label: 'Complete job', icon: Icons.task_alt_rounded, loading: _busy, color: AppColors.greenDark, onPressed: () => _complete(job))
                : PrimaryButton(label: action.label, icon: _actionIcons[action], loading: _busy, onPressed: () => _run(() => _actions.setStatus(job.id, action.targetStatus!), success: 'Status updated')),
      ),
    );
  }

  Future<void> _pickPhotos(Job job, String kind) async {
    final files = await ImagePicker().pickMultiImage(imageQuality: Limits.imageQuality, maxWidth: Limits.imageMaxWidth, limit: Limits.maxPhotos);
    if (files.isEmpty) return;
    await _run(() => _actions.uploadPhotos(job.id, kind, files.map((f) => f.path).toList()), success: 'Photos uploaded');
  }

  Future<String?> _textDialog(String title, String label, {bool required = true}) async {
    final c = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, autofocus: true, minLines: 2, maxLines: 5, maxLength: Limits.notesMax, decoration: InputDecoration(labelText: label)),
        actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Save'))],
      ),
    );
    if (ok != true || (required && c.text.trim().isEmpty)) return null;
    return c.text.trim();
  }

  Future<void> _addNote(Job job) async {
    final note = await _textDialog('Add service note', 'Work done, parts used, observations');
    if (note != null) await _run(() => _actions.addNote(job.id, note), success: 'Note saved');
  }

  Future<void> _reject(Job job) async {
    final reason = await _textDialog('Reject job?', 'Reason');
    if (reason != null) {
      await _run(() => _actions.respond(job.id, false, reason: reason), success: 'Job rejected');
      if (mounted) await Navigator.of(context).maybePop();
    }
  }

  Future<void> _complete(Job job) async {
    final performed = {for (final i in job.items) i.id: true};
    final note = TextEditingController();
    final otp = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(Space.page, 0, Space.page, MediaQuery.viewInsetsOf(c).bottom + Space.page),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Complete job', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: Space.md),
            if (job.items.isNotEmpty) Text('Work performed', style: Theme.of(c).textTheme.titleSmall),
            ...job.items.map((i) => CheckboxListTile(contentPadding: EdgeInsets.zero, value: performed[i.id], onChanged: (v) => setSheet(() => performed[i.id] = v ?? false), title: Text('${i.name} × ${i.quantity}'))),
            TextField(controller: note, minLines: 2, maxLines: 4, maxLength: Limits.notesMax, decoration: const InputDecoration(labelText: 'Completion note')),
            const SizedBox(height: Space.sm),
            TextField(controller: otp, keyboardType: TextInputType.number, maxLength: Limits.otpLength, decoration: const InputDecoration(labelText: 'Customer confirmation code (if asked)', counterText: '')),
            const SizedBox(height: Space.md),
            PrimaryButton(label: 'Mark as completed', color: AppColors.greenDark, onPressed: () => Navigator.pop(c, true)),
          ]),
        ),
      ),
    );
    if (confirmed != true) return;
    await _run(
      () => _actions.complete(job.id, performed: performed.entries.where((e) => e.value).map((e) => e.key).toList(), note: note.text, otp: otp.text),
      success: 'Job completed 🎉',
    );
  }
}
