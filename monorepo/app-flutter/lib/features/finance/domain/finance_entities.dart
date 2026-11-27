/// Invoices, payments, AMC and reminders entities. Pure Dart.
library;

class InvoiceLine {
  const InvoiceLine({required this.description, required this.quantity, required this.rate, required this.amount, required this.gstRate});
  final String description;
  final int quantity;
  final double rate;
  final double amount;
  final double gstRate;
}

class Invoice {
  const Invoice({
    required this.id,
    required this.number,
    required this.date,
    required this.status,
    required this.subtotal,
    required this.discount,
    required this.gstTotal,
    required this.grandTotal,
    required this.amountPaid,
    required this.balanceDue,
    required this.isFreeService,
    this.cgst = 0,
    this.sgst = 0,
    this.igst = 0,
    this.bookingNumber,
    this.lines = const [],
  });

  final int id;
  final String number;
  final String date;
  final String status;
  final double subtotal;
  final double discount;
  final double cgst;
  final double sgst;
  final double igst;
  final double gstTotal;
  final double grandTotal;
  final double amountPaid;
  final double balanceDue;
  final bool isFreeService;
  final String? bookingNumber;
  final List<InvoiceLine> lines;
}

class PaymentRecord {
  const PaymentRecord({required this.id, required this.number, required this.method, required this.amount, required this.status, required this.date, this.reference, this.note});
  final int id;
  final String number;
  final String method;
  final double amount;
  final String status;
  final String date;
  final String? reference;
  final String? note;
}

class AmcVisitInfo {
  const AmcVisitInfo({required this.number, required this.date, required this.status});
  final int number;
  final String date;
  final String status;
}

class AmcContract {
  const AmcContract({
    required this.id,
    required this.number,
    required this.productDetails,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.totalVisits,
    required this.completedVisits,
    required this.amount,
    this.services = const [],
    this.visits = const [],
    this.terms,
  });

  final int id;
  final String number;
  final String productDetails;
  final String startDate;
  final String endDate;
  final String status;
  final int totalVisits;
  final int completedVisits;
  final double amount;
  final List<String> services;
  final List<AmcVisitInfo> visits;
  final String? terms;

  double get progress => totalVisits == 0 ? 0 : completedVisits / totalVisits;
}

class Reminder {
  const Reminder({required this.id, required this.title, required this.dueDate, required this.status, this.fromBooking});
  final int id;
  final String title;
  final String dueDate;
  final String status;
  final String? fromBooking;
}

/// A Razorpay order created on the server for the exact amount due.
class RazorpayOrder {
  const RazorpayOrder({required this.orderId, required this.amount, required this.currency, required this.keyId});
  final String orderId;
  final double amount;
  final String currency;

  /// Public key id — safe to hold in the app; the secret never leaves the server.
  final String keyId;
}
