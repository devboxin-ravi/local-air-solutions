/// In-app notifications data access.
library;

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

class AppNotification {
  const AppNotification({required this.id, required this.title, required this.body, required this.createdAt, required this.read});
  final int id;
  final String title;
  final String body;
  final String createdAt;
  final bool read;
}

class NotificationRepository {
  NotificationRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<List<AppNotification>> list() => _api
      .getPage(ApiConstants.notifications, query: {'pageSize': 50}, item: (j) => AppNotification(id: (j['id'] as num).toInt(), title: j['title'] as String, body: j['body'] as String, createdAt: j['createdAt'] as String, read: j['readAt'] != null))
      .then((p) => p.items);

  Future<void> markAllRead() => _api.post(ApiConstants.notificationsRead, body: {'ids': 'all'}, parse: (_) {});
}
