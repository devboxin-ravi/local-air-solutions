/// Booking entities and booking-draft business rules. Pure Dart.
library;

import '../../catalog/domain/catalog_entities.dart';

class BookingLine {
  const BookingLine({required this.serviceName, required this.quantity, required this.unitPrice, required this.lineTotal, this.serviceId});
  final int? serviceId;
  final String serviceName;
  final int quantity;
  final double unitPrice;
  final double lineTotal;
}

class TimelineEvent {
  const TimelineEvent({required this.status, required this.at, this.note});
  final String status;
  final DateTime at;
  final String? note;
}

class BookingSummary {
  const BookingSummary({
    required this.id,
    required this.number,
    required this.type,
    required this.status,
    required this.paymentStatus,
    required this.scheduledDate,
    required this.estimatedTotal,
    required this.title,
    this.scheduledTime,
    this.technicianName,
  });

  final int id;
  final String number;
  final String type;
  final String status;
  final String paymentStatus;
  final String scheduledDate;
  final String? scheduledTime;
  final double estimatedTotal;
  final String title;
  final String? technicianName;
}

class BookingDetail {
  const BookingDetail({
    required this.summary,
    required this.items,
    required this.timeline,
    required this.address,
    this.technicianName,
    this.technicianPhone,
    this.invoices = const [],
    this.payments = const [],
    this.photos = const [],
  });

  final BookingSummary summary;
  final List<BookingLine> items;
  final List<TimelineEvent> timeline;
  final String address;
  final String? technicianName;
  final String? technicianPhone;
  final List<({int id, String number, double total, double balance, String status})> invoices;
  final List<({String method, double amount, String status})> payments;
  final List<({String kind, String path})> photos;
}

/// Customer booking draft with validation and estimate rules.
class BookingDraft {
  BookingDraft({required this.type});

  final String type; // SERVICE | REPAIR
  final Map<int, ({ServiceItem service, int qty})> lines = {};
  int? productId;
  String problemCategory = '';
  String problemDescription = '';
  int? addressId;
  DateTime? date;
  TimeSlot? slot;
  String instructions = '';
  String paymentMethod = 'CASH';

  bool get isRepair => type == 'REPAIR';

  double get estimate => lines.values.fold(0, (s, l) => s + l.service.billablePrice * l.qty);
  bool get hasQuotationItems => lines.values.any((l) => l.service.isQuotation) || isRepair;

  void setQty(ServiceItem s, int qty) {
    if (qty <= 0) {
      lines.remove(s.id);
    } else {
      lines[s.id] = (service: s, qty: qty.clamp(1, 50));
    }
  }

  /// Returns the first validation problem for a step, or null when valid.
  String? validateStep(int step) {
    switch (step) {
      case 0:
        if (!isRepair && lines.isEmpty) return 'Select at least one service';
        if (isRepair && problemDescription.trim().length < 5) return 'Describe the problem (at least 5 characters)';
        return null;
      case 1:
        return addressId == null ? 'Choose a service address' : null;
      case 2:
        return date == null ? 'Pick a date' : null;
      default:
        return null;
    }
  }

  Map<String, dynamic> toPayload() => {
        'bookingType': type,
        'addressId': addressId,
        'productId': productId,
        'items': lines.values.map((l) => {'serviceId': l.service.id, 'quantity': l.qty}).toList(),
        'scheduledDate': date == null ? null : '${date!.year.toString().padLeft(4, '0')}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}',
        'slotId': slot?.id,
        'problemCategory': problemCategory.trim().isEmpty ? null : problemCategory.trim(),
        'problemDescription': problemDescription.trim().isEmpty ? null : problemDescription.trim(),
        'instructions': instructions.trim().isEmpty ? null : instructions.trim(),
        'paymentMethod': paymentMethod,
      };
}
