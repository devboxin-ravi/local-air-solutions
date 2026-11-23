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
    this.bannerEnabled = true,
    this.bannerTitle = HomeDefaults.bannerTitle,
    this.bannerSubtitle = HomeDefaults.bannerSubtitle,
    this.bannerButtonText = HomeDefaults.bannerButtonText,
    this.announcement = '',
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

  /// Customer-app home content managed from the admin panel.
  final bool bannerEnabled;
  final String bannerTitle;
  final String bannerSubtitle;
  final String bannerButtonText;
  final String announcement;

  bool get prepaidRequired => paymentPolicy == 'PREPAID_REQUIRED';
}
