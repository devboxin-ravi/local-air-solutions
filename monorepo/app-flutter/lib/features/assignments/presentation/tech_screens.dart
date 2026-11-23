/// Technician app: today dashboard, job lists, history, profile.
/// Designed for outdoor use: high contrast, large touch targets, minimal steps.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/launcher.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../auth/presentation/auth_provider.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../domain/job_entities.dart';
import 'job_providers.dart';

class JobCard extends StatelessWidget {
  const JobCard({super.key, required this.job, required this.onTap});
  final Job job;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(Radii.sm)),
            child: Text(job.scheduledTime ?? Fmt.dateOnlyShort(job.scheduledDate), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.blue)),
          ),
          const Spacer(),
          StatusBadge(job.status),
        ]),
        const SizedBox(height: Space.md),
        Text(job.customerName, style: t.titleMedium),
        const SizedBox(height: 2),
        Text(job.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodyMedium),
        const SizedBox(height: Space.sm),
        Row(children: [
          const Icon(Icons.location_on_rounded, size: 18, color: AppColors.green),
          const SizedBox(width: 4),
          Expanded(child: Text(job.area ?? job.address, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(fontWeight: FontWeight.w600))),
          Text(job.number, style: t.bodySmall),
        ]),
      ]),
    );
  }
}

class TechDashboardScreen extends ConsumerWidget {
  const TechDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final dash = ref.watch(techDashboardProvider);
    final today = ref.watch(techJobsProvider('today'));
    final unread = ref.watch(unreadCountProvider);
    final t = Theme.of(context).textTheme;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(techDashboardProvider);
          ref.invalidate(notificationsProvider);
          final _ = await ref.refresh(techJobsProvider('today').future);
        },
        child: ListView(padding: EdgeInsets.zero, children: [
          Container(
            decoration: const BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.vertical(bottom: Radius.circular(28))),
            padding: EdgeInsets.fromLTRB(Space.page, MediaQuery.paddingOf(context).top + Space.md, Space.page, Space.xxl),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(Fmt.dateShort(DateTime.now().toIso8601String()), style: const TextStyle(color: Colors.white70)),
                    Text('Hi, ${user?.firstName ?? ''}', style: t.headlineSmall?.copyWith(color: Colors.white)),
                  ]),
                ),
                Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: IconButton(onPressed: () => context.push(AppRoutes.techNotifications), icon: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 28), tooltip: 'Notifications')),
              ]),
              const SizedBox(height: Space.xl),
              dash.when(
                data: (d) => Row(children: [
                  _Stat('Today', d.today, Icons.today_rounded),
                  _Stat('Pending', d.pending, Icons.pending_actions_rounded),
                  _Stat('Accepted', d.accepted, Icons.thumb_up_alt_outlined),
                  _Stat('Working', d.inProgress, Icons.handyman_rounded),
                  _Stat('Done', d.completed, Icons.task_alt_rounded),
                ]),
                loading: () => const SizedBox(height: 74),
                error: (e, _) => Text('$e', style: const TextStyle(color: Colors.white)),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(Space.page),
            child: today.when(
              data: (r) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (r.fromCache) _OfflineBanner(),
                SectionHeader('Today’s assignments', subtitle: '${r.jobs.length} job(s)'),
                if (r.jobs.isEmpty) const EmptyView(title: 'No jobs today', message: 'New assignments appear here instantly.', icon: Icons.event_available_rounded),
                ...r.jobs.map((j) => Padding(padding: const EdgeInsets.only(bottom: Space.md), child: JobCard(job: j, onTap: () => context.push(AppRoutes.techJobPath(j.id))))),
              ]),
              loading: () => const LoadingView(rows: 3),
              error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(techJobsProvider('today'))),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.icon);
  final String label;
  final int value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: Space.md),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(Radii.md)),
          child: Column(children: [
            Icon(icon, color: AppColors.green, size: 20),
            const SizedBox(height: 4),
            Text('$value', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
          ]),
        ),
      );
}

class _OfflineBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: Space.md),
        padding: const EdgeInsets.all(Space.md),
        decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(Radii.md)),
        child: const Row(children: [Icon(Icons.cloud_off_rounded, color: AppColors.amber), SizedBox(width: Space.sm), Expanded(child: Text(Messages.offlineData, style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.navy)))]),
      );
}

class TechJobsScreen extends ConsumerWidget {
  const TechJobsScreen({super.key, this.history = false});
  final bool history;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (history) {
      return Scaffold(appBar: AppBar(title: const Text('Job history')), body: const _JobList(scope: 'history'));
    }
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(title: const Text('My jobs'), bottom: const TabBar(tabs: [Tab(text: 'Active'), Tab(text: 'Upcoming')], labelColor: AppColors.blue, indicatorColor: AppColors.blue, labelStyle: TextStyle(fontWeight: FontWeight.w700))),
        body: const TabBarView(children: [_JobList(scope: 'active'), _JobList(scope: 'upcoming')]),
      ),
    );
  }
}

class _JobList extends ConsumerWidget {
  const _JobList({required this.scope});
  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(techJobsProvider(scope));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(techJobsProvider(scope).future),
      child: value.when(
        data: (r) => r.jobs.isEmpty
            ? ListView(children: [const SizedBox(height: 100), EmptyView(title: scope == 'history' ? 'No completed jobs yet' : 'No jobs here', icon: Icons.work_off_outlined)])
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: r.jobs.length + (r.fromCache ? 1 : 0),
                separatorBuilder: (_, __) => const SizedBox(height: Space.md),
                itemBuilder: (_, i) {
                  if (r.fromCache && i == 0) return _OfflineBanner();
                  final j = r.jobs[i - (r.fromCache ? 1 : 0)];
                  return JobCard(job: j, onTap: () => context.push(AppRoutes.techJobPath(j.id)));
                },
              ),
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(techJobsProvider(scope))),
      ),
    );
  }
}

class TechProfileScreen extends ConsumerWidget {
  const TechProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(padding: const EdgeInsets.all(Space.page), children: [
        AppCard(
          child: Row(children: [
            CircleAvatar(radius: 30, backgroundColor: AppColors.blue, child: Text(user?.name.substring(0, 1).toUpperCase() ?? '?', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800))),
            const SizedBox(width: Space.lg),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user?.name ?? '', style: t.titleMedium),
                Text('${AppConstants.countryCode} ${user?.mobile ?? ''}', style: t.bodyMedium),
                const SizedBox(height: 4),
                const StatusBadge('TECHNICIAN'),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: Space.xl),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            ListTile(leading: const Icon(Icons.history_rounded, color: AppColors.blue), title: const Text('Job history'), trailing: const Icon(Icons.chevron_right), onTap: () => context.go(AppRoutes.techHistory)),
            const Divider(indent: 56),
            ListTile(leading: const Icon(Icons.notifications_none_rounded, color: AppColors.blue), title: const Text('Notifications'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push(AppRoutes.techNotifications)),
            const Divider(indent: 56),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: AppColors.red),
              title: const Text('Log out', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w600)),
              onTap: () async {
                if (await confirmDialog(context, title: 'Log out?', message: 'Unsynced actions will be lost.', confirm: 'Log out', destructive: true)) {
                  await ref.read(authControllerProvider.notifier).logout();
                }
              },
            ),
          ]),
        ),
        const SizedBox(height: Space.xl),
        Center(child: Text('${AppConfig.appName} · Technician v${AppConfig.appVersion}', style: t.bodySmall)),
      ]),
    );
  }
}

/// Opens directions to the job location (verified coordinates or address search).
Future<void> openJobDirections(Job job) => Launcher.directions(lat: job.latitude, lng: job.longitude, address: job.address);
