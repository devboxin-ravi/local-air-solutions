/// In-app notifications (shared by customer and technician apps).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../data/notification_repository.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((_) => NotificationRepository());
final notificationsProvider = FutureProvider<List<AppNotification>>((ref) => ref.read(notificationRepositoryProvider).list());
final unreadCountProvider = Provider<int>((ref) => ref.watch(notificationsProvider).maybeWhen(data: (l) => l.where((n) => !n.read).length, orElse: () => 0));

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationRepositoryProvider).markAllRead();
              ref.invalidate(notificationsProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
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
                    return AppCard(
                      color: n.read ? AppColors.surface : AppColors.blueSoft,
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        IconBox(Icons.notifications_active_outlined, color: n.read ? AppColors.slate : AppColors.blue, background: n.read ? AppColors.background : Colors.white, size: 40),
                        const SizedBox(width: Space.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(n.title, style: Theme.of(context).textTheme.titleSmall),
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
