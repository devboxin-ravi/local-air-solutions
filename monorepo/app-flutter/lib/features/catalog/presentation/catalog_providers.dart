/// Catalogue providers.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/catalog_repository.dart';
import '../data/favorites_repository.dart';
import '../domain/catalog_rules.dart';
import '../domain/catalog_entities.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((_) => CatalogRepository());

final publicSettingsProvider = FutureProvider<PublicSettings>((ref) => ref.read(catalogRepositoryProvider).publicSettings());
final categoriesProvider = FutureProvider<List<Category>>((ref) => ref.read(catalogRepositoryProvider).categories());
final popularServicesProvider = FutureProvider<List<ServiceItem>>((ref) => ref.read(catalogRepositoryProvider).services(popular: true, pageSize: 10));
final allServicesProvider = FutureProvider<List<ServiceItem>>((ref) => ref.read(catalogRepositoryProvider).services());
final categoryServicesProvider = FutureProvider.family<List<ServiceItem>, int>((ref, id) => ref.read(catalogRepositoryProvider).services(categoryId: id));
final serviceProvider = FutureProvider.family<ServiceItem, int>((ref, id) => ref.read(catalogRepositoryProvider).service(id));
final productsProvider = FutureProvider<List<Product>>((ref) => ref.read(catalogRepositoryProvider).products());
// Lookups that admins can change at any time (cities served, slot availability) are auto-disposed so
// every screen visit refetches them instead of showing a list cached from an earlier visit.
final statesProvider = FutureProvider.autoDispose<List<NamedRef>>((ref) => ref.read(catalogRepositoryProvider).states());
final citiesProvider = FutureProvider.autoDispose.family<List<NamedRef>, int>((ref, stateId) => ref.read(catalogRepositoryProvider).cities(stateId));
final slotsProvider = FutureProvider.autoDispose.family<List<TimeSlot>, ({int branchId, String date})>((ref, k) => ref.read(catalogRepositoryProvider).slots(k.branchId, k.date));

/// Client-side search across the active catalogue.
final serviceSearchProvider = Provider.family<AsyncValue<List<ServiceItem>>, String>((ref, q) {
  final all = ref.watch(allServicesProvider);
  final term = q.trim().toLowerCase();
  return all.whenData((list) => term.isEmpty ? list : list.where((s) => s.name.toLowerCase().contains(term) || s.categoryName.toLowerCase().contains(term) || (s.description ?? '').toLowerCase().contains(term)).toList());
});

/// Search + category filter + sort over the full catalogue (rules live in the domain layer).
final serviceViewProvider = Provider.family<AsyncValue<List<ServiceItem>>, ({String query, int? categoryId, ServiceSort sort})>(
  (ref, k) => ref.watch(allServicesProvider).whenData((list) => viewServices(list, query: k.query, categoryId: k.categoryId, sort: k.sort)),
);

final favoritesRepositoryProvider = Provider<FavoritesRepository>((_) => FavoritesRepository());

/// Favourite service ids, saved on the device.
class FavoritesNotifier extends Notifier<Set<int>> {
  @override
  Set<int> build() => ref.read(favoritesRepositoryProvider).load();

  void toggle(int serviceId) {
    final next = {...state};
    if (!next.remove(serviceId)) next.add(serviceId);
    state = next;
    ref.read(favoritesRepositoryProvider).save(next);
  }
}

final favoritesProvider = NotifierProvider<FavoritesNotifier, Set<int>>(FavoritesNotifier.new);
