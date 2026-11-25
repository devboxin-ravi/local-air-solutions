/// Favourite services, kept on the device (local cache box). Data access only.
library;

import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/constants/app_constants.dart';

class FavoritesRepository {
  /// The cache box is opened at app start; when it isn't (e.g. in widget tests) favourites simply don't persist.
  Box<String>? get _box => Hive.isBoxOpen(AppConstants.hiveBoxCache) ? Hive.box<String>(AppConstants.hiveBoxCache) : null;

  Set<int> load() {
    final raw = _box?.get(AppConstants.cacheFavoriteServices);
    if (raw == null) return <int>{};
    try {
      return (jsonDecode(raw) as List).whereType<int>().toSet();
    } on FormatException {
      return <int>{};
    }
  }

  Future<void> save(Set<int> ids) async => _box?.put(AppConstants.cacheFavoriteServices, jsonEncode(ids.toList()));
}
