/// Customer profile, addresses and home summary data access.
library;

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../bookings/data/booking_repository.dart';
import '../domain/account_entities.dart';

Address addressFromJson(Map<String, dynamic> j) => Address(
      id: (j['id'] as num).toInt(),
      label: j['label'] as String,
      line1: j['line1'] as String,
      line2: j['line2'] as String?,
      landmark: j['landmark'] as String?,
      stateId: (j['stateId'] as num).toInt(),
      cityId: (j['cityId'] as num).toInt(),
      cityName: (j['city'] as Map?)?['name'] as String? ?? '',
      stateName: (j['state'] as Map?)?['name'] as String?,
      pincode: j['pincode'] as String? ?? '',
      isDefault: j['isDefault'] as bool? ?? false,
      serviceAreaName: (j['serviceArea'] as Map?)?['name'] as String?,
    );

class AccountRepository {
  AccountRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<CustomerProfile> profile() => _api.get(ApiConstants.meProfile, parse: (d) {
        final j = d as Map<String, dynamic>;
        return CustomerProfile(
          id: (j['id'] as num).toInt(),
          code: j['customerCode'] as String,
          fullName: j['fullName'] as String,
          mobile: j['mobile'] as String,
          email: j['email'] as String?,
          alternateMobile: j['alternateMobile'] as String?,
          addresses: ((j['addresses'] as List?) ?? const []).map((e) => addressFromJson(e as Map<String, dynamic>)).toList(),
        );
      });

  Future<void> updateProfile({required String fullName, String? email, String? alternateMobile}) => _api.patch(ApiConstants.meProfile,
      body: {'fullName': fullName.trim(), 'email': (email?.trim().isEmpty ?? true) ? null : email!.trim(), 'alternateMobile': (alternateMobile?.trim().isEmpty ?? true) ? null : alternateMobile!.trim()}, parse: (_) {});

  Future<List<Address>> addresses() => _api.get(ApiConstants.meAddresses, parse: (d) => (d as List).map((e) => addressFromJson(e as Map<String, dynamic>)).toList());

  /// Branch serving an address (via its service area), used for slot lookup.
  Future<List<({int addressId, int? branchId})>> addressBranches() => _api.get(ApiConstants.meAddresses,
      parse: (d) => (d as List).map((e) => (addressId: (e['id'] as num).toInt(), branchId: ((e['serviceArea'] as Map?)?['branchId'] as num?)?.toInt())).toList());

  Future<Address> saveAddress(Map<String, dynamic> body, {int? id}) => id == null
      ? _api.post(ApiConstants.meAddresses, body: body, parse: (d) => addressFromJson(d as Map<String, dynamic>))
      : _api.patch(ApiConstants.meAddress(id), body: body, parse: (d) => addressFromJson(d as Map<String, dynamic>));

  Future<void> deleteAddress(int id) => _api.delete(ApiConstants.meAddress(id));

  Future<HomeSummary> home() => _api.get(ApiConstants.meHome, parse: (d) {
        final j = d as Map<String, dynamic>;
        return HomeSummary(
          upcoming: ((j['upcomingBookings'] as List?) ?? const []).map((e) => bookingSummaryFromJson(e as Map<String, dynamic>)).toList(),
          reminders: ((j['reminders'] as List?) ?? const [])
              .map((e) => (id: (e['id'] as num).toInt(), service: ((e['service'] as Map?)?['name'] as String?) ?? 'AC service', dueDate: e['dueDate'] as String, status: e['status'] as String))
              .toList(),
          amcCount: ((j['amcContracts'] as List?) ?? const []).length,
          outstanding: Fmt.toNum(j['outstandingBalance']),
        );
      });
}
