/// Catalogue & master-data entities. Pure Dart.
library;

import '../../../core/constants/app_constants.dart';

class Category {
  const Category({required this.id, required this.name, this.description, this.icon, this.serviceCount = 0});
  final int id;
  final String name;
  final String? description;
  final String? icon;
  final int serviceCount;
}

class ServiceItem {
  const ServiceItem({
    required this.id,
    required this.code,
    required this.name,
    required this.categoryId,
    required this.categoryName,
    required this.pricingType,
    required this.price,
    required this.durationMinutes,
    required this.gstApplicable,
    required this.gstRate,
    this.description,
    this.imageUrl,
    this.isPopular = false,
  });

  final int id;
  final String code;
  final String name;
  final String? description;
  final String? imageUrl;
  final int categoryId;
  final String categoryName;
  final String pricingType;
  final double price;
  final int durationMinutes;
  final bool gstApplicable;
  final double gstRate;
  final bool isPopular;

  bool get isQuotation => pricingType == 'QUOTATION';
  bool get isFree => pricingType == 'FREE';
  bool get isStarting => pricingType == 'STARTING';

  /// Amount charged at booking time (quotation/free items are priced on inspection or free).
  double get billablePrice => (isQuotation || isFree) ? 0 : price;
}

class Product {
  const Product({required this.id, required this.name, this.category});
  final int id;
  final String name;
  final String? category;
}

class NamedRef {
  const NamedRef(this.id, this.name);
  final int id;
  final String name;
}

class TimeSlot {
  const TimeSlot({required this.id, required this.startTime, required this.endTime, required this.available});
  final int id;
  final String startTime;
  final String endTime;
  final int available;
  String get label => '$startTime – $endTime';
}

/// Home promo banner managed in Admin → Settings → Customer App.
class PromoSlideConfig {
  const PromoSlideConfig({required this.tag, required this.title, required this.subtitle, required this.buttonText, required this.action, required this.style});
  final String tag;
  final String title;
  final String subtitle;
  final String buttonText;

  /// SERVICES | BOOK | REPAIR | AMC
  final String action;

  /// GREEN | BLUE | ORANGE
  final String style;

  static const List<PromoSlideConfig> defaults = [
    PromoSlideConfig(tag: 'Featured Service', title: 'Summer-ready AC', subtitle: 'Deep cleaning & servicing for better cooling and lower bills', buttonText: 'Book now', action: 'SERVICES', style: 'GREEN'),
    PromoSlideConfig(tag: 'AMC Plans', title: 'Year-round AC Care Plan', subtitle: 'Scheduled visits and priority support with an AMC.', buttonText: 'View plans', action: 'AMC', style: 'BLUE'),
    PromoSlideConfig(tag: 'Quick Repair', title: 'Quick AC Repair', subtitle: 'AC not cooling? A trained expert can visit today.', buttonText: 'Book repair', action: 'REPAIR', style: 'ORANGE'),
  ];
}

/// "Need a service today?" home card.
class TodayCardConfig {
  const TodayCardConfig({required this.enabled, required this.title, required this.subtitle, required this.buttonText});
  final bool enabled;
  final String title;
  final String subtitle;
  final String buttonText;

  static const TodayCardConfig defaults = TodayCardConfig(enabled: true, title: 'Need a Service Today?', subtitle: 'Quick booking • Trusted experts • At your doorstep', buttonText: 'Book Now');
}

/// One first-run welcome screen.
class OnboardingPageConfig {
  const OnboardingPageConfig({required this.title, required this.text});
  final String title;
  final String text;

  static const List<OnboardingPageConfig> defaults = [
    OnboardingPageConfig(title: 'Expert AC care at home', text: 'Installation, servicing, gas refilling and repairs by trained technicians.'),
    OnboardingPageConfig(title: 'Book in under a minute', text: 'Pick a service, choose a slot and track your technician live.'),
    OnboardingPageConfig(title: 'Transparent & protected', text: 'Clear pricing, GST invoices, AMC plans and timely service reminders.'),
  ];
}

/// One step of the customer booking tracker, as configured in the admin panel.
class TrackerStepConfig {
  const TrackerStepConfig({required this.status, required this.visible, required this.label, required this.title, required this.hint});
  final String status;
  final bool visible;

  /// Short text under the stepper icon.
  final String label;
  final String title;
  final String hint;
}

class PublicSettings {
  const PublicSettings({
    required this.companyName,
    required this.tagline,
    required this.supportPhone,
    required this.supportWhatsapp,
    required this.paymentPolicy,
    required this.upiEnabled,
    required this.upiId,
    required this.upiPayeeName,
    required this.cashEnabled,
    required this.razorpayEnabled,
    this.announcement = '',
    this.slides = PromoSlideConfig.defaults,
    this.trustPoints = HomeDefaults.trustPoints,
    this.todayCard = TodayCardConfig.defaults,
    this.showCategories = true,
    this.showPopular = true,
    this.showTrustPoints = true,
    this.onboarding = OnboardingPageConfig.defaults,
    this.trackerSteps = const [],
  });

  final String companyName;
  final String tagline;
  final String supportPhone;
  final String supportWhatsapp;
  final String paymentPolicy;
  final bool upiEnabled;
  final String upiId;
  final String upiPayeeName;
  final bool cashEnabled;
  final bool razorpayEnabled;

  /// Customer-app content managed from the admin panel.
  final String announcement;
  final List<PromoSlideConfig> slides;
  final List<String> trustPoints;
  final TodayCardConfig todayCard;
  final bool showCategories;
  final bool showPopular;
  final bool showTrustPoints;
  final List<OnboardingPageConfig> onboarding;

  /// Booking tracker steps from the admin panel (empty → app defaults).
  final List<TrackerStepConfig> trackerSteps;

  bool get prepaidRequired => paymentPolicy == 'PREPAID_REQUIRED';
}
