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
