/// Catalogue rules: searching, filtering and sorting services. Pure Dart, no framework.
library;

import 'catalog_entities.dart';

/// How the services list is ordered.
enum ServiceSort { recommended, priceLowToHigh, priceHighToLow, shortestFirst }

/// Services matching [query] (name, category, code, description) and [categoryId], in [sort] order.
/// Sorting is stable: services that tie keep the catalogue's own order.
List<ServiceItem> viewServices(List<ServiceItem> all, {String query = '', int? categoryId, ServiceSort sort = ServiceSort.recommended}) {
  final words = query.trim().toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  bool matches(ServiceItem s) {
    if (categoryId != null && s.categoryId != categoryId) return false;
    if (words.isEmpty) return true;
    final haystack = '${s.name} ${s.categoryName} ${s.code} ${s.description ?? ''}'.toLowerCase();
    return words.every(haystack.contains);
  }

  final indexed = all.where(matches).toList().asMap().entries.toList();
  // Quotation-only services have no price; they sort after priced ones in either direction.
  double priceKey(ServiceItem s, {required bool ascending}) => s.isQuotation ? (ascending ? double.infinity : double.negativeInfinity) : s.billablePrice;

  int compare(MapEntry<int, ServiceItem> a, MapEntry<int, ServiceItem> b) {
    final x = a.value;
    final y = b.value;
    final int byRule = switch (sort) {
      ServiceSort.recommended => (y.isPopular ? 1 : 0) - (x.isPopular ? 1 : 0),
      ServiceSort.priceLowToHigh => priceKey(x, ascending: true).compareTo(priceKey(y, ascending: true)),
      ServiceSort.priceHighToLow => priceKey(y, ascending: false).compareTo(priceKey(x, ascending: false)),
      ServiceSort.shortestFirst => x.durationMinutes.compareTo(y.durationMinutes),
    };
    return byRule != 0 ? byRule : a.key.compareTo(b.key);
  }

  indexed.sort(compare);
  return [for (final e in indexed) e.value];
}
