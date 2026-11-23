/// Customer invoices, payments (UPI submission), AMC and reminders data access.
library;

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../domain/finance_entities.dart';

Invoice invoiceFromJson(Map<String, dynamic> j) => Invoice(
      id: (j['id'] as num).toInt(),
      number: j['invoiceNumber'] as String,
      date: j['invoiceDate'] as String,
      status: j['status'] as String,
      subtotal: Fmt.toNum(j['subtotal']),
      discount: Fmt.toNum(j['discount']),
      cgst: Fmt.toNum(j['cgst']),
      sgst: Fmt.toNum(j['sgst']),
      igst: Fmt.toNum(j['igst']),
      gstTotal: Fmt.toNum(j['gstTotal']),
      grandTotal: Fmt.toNum(j['grandTotal']),
      amountPaid: Fmt.toNum(j['amountPaid']),
      balanceDue: Fmt.toNum(j['balanceDue']),
      isFreeService: j['isFreeService'] as bool? ?? false,
      bookingNumber: (j['booking'] as Map?)?['bookingNumber'] as String?,
      lines: ((j['items'] as List?) ?? const [])
          .map((e) => InvoiceLine(description: e['description'] as String, quantity: (e['quantity'] as num).toInt(), rate: Fmt.toNum(e['rate']), amount: Fmt.toNum(e['amount']), gstRate: Fmt.toNum(e['gstRate'])))
          .toList(),
    );

PaymentRecord paymentFromJson(Map<String, dynamic> j) => PaymentRecord(
      id: (j['id'] as num).toInt(),
      number: j['paymentNumber'] as String,
      method: j['method'] as String,
      amount: Fmt.toNum(j['amount']),
      status: j['status'] as String,
      date: (j['receivedAt'] ?? j['createdAt']) as String,
      reference: j['referenceNumber'] as String?,
      note: j['verificationNote'] as String?,
    );

AmcContract amcFromJson(Map<String, dynamic> j) {
  final visits = (j['visits'] as List?) ?? const [];
  return AmcContract(
    id: (j['id'] as num).toInt(),
    number: j['amcNumber'] as String,
    productDetails: j['productDetails'] as String,
    startDate: j['startDate'] as String,
    endDate: j['endDate'] as String,
    status: j['status'] as String,
    totalVisits: (j['totalVisits'] as num).toInt(),
    completedVisits: (j['completedVisits'] as num?)?.toInt() ?? visits.where((v) => (v as Map)['status'] == 'COMPLETED').length,
    amount: Fmt.toNum(j['contractAmount']),
    terms: j['terms'] as String?,
    services: ((j['services'] as List?) ?? const []).map((s) => ((s as Map)['service'] as Map)['name'] as String).toList(),
    visits: visits.map((v) => AmcVisitInfo(number: ((v as Map)['visitNumber'] as num).toInt(), date: v['scheduledDate'] as String, status: v['status'] as String)).toList(),
  );
}

class FinanceRepository {
  FinanceRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<List<Invoice>> invoices() => _api.getPage(ApiConstants.meInvoices, query: {'pageSize': 50}, item: invoiceFromJson).then((p) => p.items);
  Future<Invoice> invoice(int id) => _api.get(ApiConstants.meInvoice(id), parse: (d) => invoiceFromJson(d as Map<String, dynamic>));
  Future<List<PaymentRecord>> payments() => _api.getPage(ApiConstants.mePayments, query: {'pageSize': 50}, item: paymentFromJson).then((p) => p.items);

  /// Submits a UPI reference (and optional screenshot) for admin verification.
  /// The idempotency key prevents duplicates when the user retries on a flaky network.
  Future<PaymentRecord> submitUpi({int? bookingId, int? invoiceId, required double amount, required String reference, String? screenshotPath, required String idempotencyKey}) => _api.upload(
        ApiConstants.meUpiPayment,
        field: 'proof',
        files: screenshotPath == null ? const [] : [screenshotPath],
        fields: {
          if (bookingId != null) 'bookingId': '$bookingId',
          if (invoiceId != null) 'invoiceId': '$invoiceId',
          'amount': amount.toStringAsFixed(2),
          'referenceNumber': reference.trim(),
        },
        headers: {ApiConstants.idempotencyHeader: idempotencyKey},
        parse: (d) => paymentFromJson(d as Map<String, dynamic>),
      );

  Future<List<AmcContract>> amcContracts() => _api.getPage(ApiConstants.meAmc, query: {'pageSize': 50}, item: amcFromJson).then((p) => p.items);
  Future<AmcContract> amc(int id) => _api.get(ApiConstants.meAmcOne(id), parse: (d) => amcFromJson(d as Map<String, dynamic>));

  Future<List<Reminder>> reminders() => _api
      .getPage(ApiConstants.meReminders, query: {'bucket': 'all', 'pageSize': 50}, item: (j) => Reminder(
            id: (j['id'] as num).toInt(),
            title: ((j['service'] as Map?)?['name'] as String?) ?? (j['amcContract'] != null ? 'AMC ${(j['amcContract'] as Map)['amcNumber']}' : 'AC service'),
            dueDate: j['dueDate'] as String,
            status: j['status'] as String,
            fromBooking: (j['booking'] as Map?)?['bookingNumber'] as String?,
          ))
      .then((p) => p.items);
}
