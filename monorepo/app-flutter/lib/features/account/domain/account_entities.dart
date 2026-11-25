/// Customer profile & address entities. Pure Dart.
library;

class Address {
  const Address({
    required this.id,
    required this.label,
    required this.line1,
    required this.stateId,
    required this.cityId,
    required this.cityName,
    required this.pincode,
    required this.isDefault,
    this.line2,
    this.landmark,
    this.stateName,
    this.serviceAreaName,
  });

  final int id;
  final String label;
  final String line1;
  final String? line2;
  final String? landmark;
  final int stateId;
  final int cityId;
  final String cityName;
  final String? stateName;
  final String pincode;
  final bool isDefault;
  final String? serviceAreaName;

  String get full => [line1, line2, landmark, cityName, pincode].where((s) => s != null && s.isNotEmpty).join(', ');
}

class CustomerProfile {
  const CustomerProfile({required this.id, required this.code, required this.fullName, required this.mobile, this.email, this.alternateMobile, this.addresses = const []});
  final int id;
  final String code;
  final String fullName;
  final String mobile;
  final String? email;
  final String? alternateMobile;
  final List<Address> addresses;
}

class HomeSummary {
  const HomeSummary({required this.upcoming, required this.reminders, required this.amcCount, required this.outstanding});
  final List<dynamic> upcoming; // List<BookingSummary>
  final List<({int id, String service, String dueDate, String status})> reminders;
  final int amcCount;
  final double outstanding;
}

/// Address details resolved from the device's current GPS position.
class DetectedLocation {
  const DetectedLocation({required this.latitude, required this.longitude, this.line1, this.line2, this.city, this.state, this.pincode});

  final double latitude;
  final double longitude;
  final String? line1;
  final String? line2;
  final String? city;
  final String? state;
  final String? pincode;
}

/// Finds the item whose name matches [query] (case/space-insensitive; exact first, then contains).
T? matchByName<T>(Iterable<T> items, String Function(T) nameOf, String? query) {
  String norm(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
  if (query == null || norm(query).isEmpty) return null;
  final q = norm(query);
  for (final i in items) {
    if (norm(nameOf(i)) == q) return i;
  }
  for (final i in items) {
    final n = norm(nameOf(i));
    if (n.isNotEmpty && (n.contains(q) || q.contains(n))) return i;
  }
  return null;
}
