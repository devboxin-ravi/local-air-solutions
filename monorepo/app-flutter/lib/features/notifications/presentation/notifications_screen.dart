/// In-app notifications (shared by customer and technician apps).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../data/notification_repository.dart';
import '../../auth/presentation/auth_provider.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((_) => NotificationRepository());
final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(notificationRepositoryProvider).list();
});
final unreadCountProvider = Provider<int>((ref) => ref.watch(notificationsProvider).maybeWhen(data: (l) => l.where((n) => !n.read).length, orElse: () => 0));

/// Opening this screen counts as seeing every notification: the bell's unread count clears
/// (saved on the server), while the ones that were new stay highlighted until the screen closes.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  /// Ids that were unread when this visit started (kept highlighted for this visit).
  Set<int> _newThisVisit = const {};
  bool _markedSeen = false;

  void _markSeen(List<AppNotification> items) {
    if (_markedSeen) return;
    _markedSeen = true;
    final unread = items.where((n) => !n.read).map((n) => n.id).toSet();
    if (unread.isEmpty) return;
    setState(() => _newThisVisit = unread);
    ref.read(notificationRepositoryProvider).markAllRead().then((_) {
      if (mounted) ref.invalidate(notificationsProvider);
    }).catchError((Object _) {
      // Offline: try again next time the screen opens.
      _markedSeen = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(notificationsProvider);
    final items = value.value;
    if (items != null && !_markedSeen) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _markSeen(items) : null);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(notificationsProvider.future),
        child: AsyncBody<List<AppNotification>>(
          value: value,
          onRetry: () => ref.invalidate(notificationsProvider),
          data: (items) => items.isEmpty
              ? ListView(children: const [SizedBox(height: 120), EmptyView(title: 'No notifications yet', message: 'Booking updates and reminders appear here.', icon: Icons.notifications_none_rounded)])
              : ListView.separated(
                  padding: const EdgeInsets.all(Space.page),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                  itemBuilder: (_, i) {
                    final n = items[i];
                    final isNew = !n.read || _newThisVisit.contains(n.id);
                    return AppCard(
                      color: isNew ? AppColors.blueSoft : AppColors.surface,
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        IconBox(Icons.notifications_active_outlined, color: isNew ? AppColors.blue : AppColors.slate, background: isNew ? Colors.white : AppColors.background, size: 40),
                        const SizedBox(width: Space.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(n.title, style: Theme.of(context).textTheme.titleSmall)),
                              if (isNew) Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.blue, shape: BoxShape.circle)),
                            ]),
                            const SizedBox(height: 2),
                            Text(n.body, style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 4),
                            Text(Fmt.relative(n.createdAt), style: Theme.of(context).textTheme.bodySmall),
                          ]),
                        ),
                      ]),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
