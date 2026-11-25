/// Catalogue, master data, slots and public settings data access.
library;

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../domain/catalog_entities.dart';

Category categoryFromJson(Map<String, dynamic> j) => Category(
      id: (j['id'] as num).toInt(),
      name: j['name'] as String,
      description: j['description'] as String?,
      icon: j['icon'] as String?,
      serviceCount: ((j['_count'] as Map?)?['services'] as num?)?.toInt() ?? 0,
    );

ServiceItem serviceFromJson(Map<String, dynamic> j) => ServiceItem(
      id: (j['id'] as num).toInt(),
      code: j['code'] as String,
      name: j['name'] as String,
      description: j['description'] as String?,
      imageUrl: j['imageUrl'] as String?,
      categoryId: (j['categoryId'] as num).toInt(),
      categoryName: (j['category'] as Map?)?['name'] as String? ?? '',
      pricingType: j['pricingType'] as String,
      price: Fmt.toNum(j['effectivePrice'] ?? j['basePrice']),
      durationMinutes: (j['durationMinutes'] as num).toInt(),
      gstApplicable: j['gstApplicable'] as bool? ?? true,
      gstRate: Fmt.toNum(j['gstRate']),
      isPopular: j['isPopular'] as bool? ?? false,
    );

class CatalogRepository {
  CatalogRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<List<Category>> categories() => _api.get(ApiConstants.categories, parse: (d) => (d as List).map((e) => categoryFromJson(e as Map<String, dynamic>)).toList());

  Future<List<ServiceItem>> services({int? categoryId, String? search, bool? popular, int pageSize = 100}) => _api
      .getPage(ApiConstants.services, query: {'categoryId': categoryId, 'search': search, 'isPopular': popular, 'pageSize': pageSize, 'sortBy': 'sortOrder', 'sortOrder': 'asc'}, item: serviceFromJson)
      .then((p) => p.items);

  Future<ServiceItem> service(int id) => _api.get(ApiConstants.service(id), parse: (d) => serviceFromJson(d as Map<String, dynamic>));

  Future<List<Product>> products() => _api.get(ApiConstants.products, query: {'activeOnly': true}, parse: (d) => (d as List).map((e) => Product(id: (e['id'] as num).toInt(), name: e['name'] as String, category: e['category'] as String?)).toList());

  Future<List<NamedRef>> states() => _api.get(ApiConstants.states, query: {'activeOnly': true}, parse: (d) => (d as List).map((e) => NamedRef((e['id'] as num).toInt(), e['name'] as String)).toList());

  Future<List<NamedRef>> cities(int stateId) => _api.get(ApiConstants.cities, query: {'stateId': stateId, 'activeOnly': true}, parse: (d) => (d as List).map((e) => NamedRef((e['id'] as num).toInt(), e['name'] as String)).toList());

  Future<List<TimeSlot>> slots(int branchId, String date) => _api.get(ApiConstants.availableSlots, query: {'branchId': branchId, 'date': date}, parse: (d) => (d as List)
      .map((e) => TimeSlot(id: (e['id'] as num).toInt(), startTime: e['startTime'] as String, endTime: e['endTime'] as String, available: (e['available'] as num).toInt()))
      .toList());

  Future<PublicSettings> publicSettings() => _api.get(ApiConstants.publicSettings, parse: (d) {
        final company = (d as Map)['company'] as Map;
        final pay = d['payment'] as Map;
        final home = (d['appHome'] as Map?) ?? const {};
        final tracker = ((d['bookingTracker'] as Map?)?['steps'] as List?) ?? const [];
        String s(Object? v) => (v as String?) ?? '';
        String or(Object? v, String fallback) => s(v).trim().isEmpty ? fallback : s(v).trim();
        return PublicSettings(
          companyName: s(company['name']).isEmpty ? AppConfig.appName : s(company['name']),
          tagline: s(company['tagline']),
          supportPhone: s(company['supportPhone']).isNotEmpty ? s(company['supportPhone']) : (s(company['phone']).isNotEmpty ? s(company['phone']) : AppConfig.supportPhone),
          supportWhatsapp: s(company['supportWhatsapp']).isNotEmpty ? s(company['supportWhatsapp']) : AppConfig.supportWhatsapp,
          paymentPolicy: s(pay['policy']),
          upiEnabled: pay['upiEnabled'] == true,
          upiId: s(pay['upiId']),
          upiPayeeName: s(pay['upiPayeeName']),
          cashEnabled: pay['cashEnabled'] == true,
          razorpayEnabled: pay['razorpayEnabled'] == true,
          announcement: s(home['announcement']).trim(),
          // Older servers send no slides → keep the built-in banners.
          slides: home['slides'] is List
              ? (home['slides'] as List)
                  .whereType<Map>()
                  .map((e) => PromoSlideConfig(tag: s(e['tag']).trim(), title: s(e['title']).trim(), subtitle: s(e['subtitle']).trim(), buttonText: or(e['buttonText'], HomeDefaults.bannerButtonText), action: s(e['action']), style: s(e['style'])))
                  .where((e) => e.title.isNotEmpty)
                  .toList()
              : PromoSlideConfig.defaults,
          trustPoints: home['trustPoints'] is List ? (home['trustPoints'] as List).map((e) => s(e).trim()).where((e) => e.isNotEmpty).toList() : HomeDefaults.trustPoints,
          todayCard: home['todayCard'] is Map
              ? TodayCardConfig(
                  enabled: (home['todayCard'] as Map)['enabled'] != false,
                  title: or((home['todayCard'] as Map)['title'], TodayCardConfig.defaults.title),
                  subtitle: s((home['todayCard'] as Map)['subtitle']).trim(),
                  buttonText: or((home['todayCard'] as Map)['buttonText'], TodayCardConfig.defaults.buttonText),
                )
              : TodayCardConfig.defaults,
          showCategories: home['showCategories'] != false,
          showPopular: home['showPopular'] != false,
          showTrustPoints: home['showTrustPoints'] != false,
          onboarding: home['onboarding'] is List && (home['onboarding'] as List).isNotEmpty
              ? (home['onboarding'] as List).whereType<Map>().map((e) => OnboardingPageConfig(title: s(e['title']).trim(), text: s(e['text']).trim())).toList()
              : OnboardingPageConfig.defaults,
          trackerSteps: tracker
              .whereType<Map>()
              .where((e) => s(e['status']).isNotEmpty)
              .map((e) => TrackerStepConfig(status: s(e['status']), visible: e['visible'] != false, label: s(e['label']).trim(), title: s(e['title']).trim(), hint: s(e['hint']).trim()))
              .toList(),
        );
      });
}
