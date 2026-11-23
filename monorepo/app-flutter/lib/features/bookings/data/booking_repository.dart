/// Customer bookings data access.
library;

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../domain/booking_entities.dart';

BookingSummary bookingSummaryFromJson(Map<String, dynamic> j) {
  final items = (j['items'] as List?) ?? const [];
  final assignments = (j['assignments'] as List?) ?? const [];
  final title = items.isNotEmpty ? items.map((i) => (i as Map)['serviceName']).join(', ') : (j['problemDescription'] as String? ?? 'Repair request');
  return BookingSummary(
    id: (j['id'] as num).toInt(),
    number: j['bookingNumber'] as String,
    type: j['bookingType'] as String? ?? (items.isEmpty ? 'REPAIR' : 'SERVICE'),
    status: j['status'] as String,
    paymentStatus: j['paymentStatus'] as String? ?? 'UNPAID',
    scheduledDate: j['scheduledDate'] as String,
    scheduledTime: j['scheduledTime'] as String?,
    estimatedTotal: Fmt.toNum(j['estimatedTotal']),
    title: title,
    technicianName: assignments.isNotEmpty ? ((assignments.first as Map)['staff'] as Map?)?['user']?['name'] as String? : null,
  );
}

class BookingRepository {
  BookingRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<PagedResult<BookingSummary>> myBookings({String? status, int page = 1}) =>
      _api.getPage(ApiConstants.meBookings, query: {'status': status, 'page': page, 'pageSize': 20, 'sortBy': 'createdAt', 'sortOrder': 'desc'}, item: bookingSummaryFromJson);

  Future<BookingDetail> detail(int id) => _api.get(ApiConstants.meBooking(id), parse: (d) {
        final j = d as Map<String, dynamic>;
        final addr = (j['address'] as Map?) ?? const {};
        final tech = j['technician'] as Map?;
        return BookingDetail(
          summary: bookingSummaryFromJson(j),
          items: ((j['items'] as List?) ?? const [])
              .map((e) => BookingLine(serviceId: (e['serviceId'] as num?)?.toInt(), serviceName: e['serviceName'] as String, quantity: (e['quantity'] as num).toInt(), unitPrice: Fmt.toNum(e['unitPrice']), lineTotal: Fmt.toNum(e['lineTotal'])))
              .toList(),
          timeline: ((j['timeline'] as List?) ?? const []).map((e) => TimelineEvent(status: e['status'] as String, at: DateTime.parse(e['at'] as String).toLocal(), note: e['note'] as String?)).toList(),
          address: [addr['line1'], addr['line2'], addr['landmark'], addr['city'], addr['pincode']].where((s) => s != null && '$s'.isNotEmpty).join(', '),
          technicianName: tech?['name'] as String?,
          technicianPhone: tech?['phone'] as String?,
          invoices: ((j['invoices'] as List?) ?? const [])
              .map((e) => (id: (e['id'] as num).toInt(), number: e['invoiceNumber'] as String, total: Fmt.toNum(e['grandTotal']), balance: Fmt.toNum(e['balanceDue']), status: e['status'] as String))
              .toList(),
          payments: ((j['payments'] as List?) ?? const []).map((e) => (method: e['method'] as String, amount: Fmt.toNum(e['amount']), status: e['status'] as String)).toList(),
          photos: ((j['attachments'] as List?) ?? const []).map((e) => (kind: e['kind'] as String, path: e['filePath'] as String)).toList(),
        );
      });

  Future<BookingSummary> create(BookingDraft draft) => _api.post(ApiConstants.meBookings, body: draft.toPayload(), parse: (d) => bookingSummaryFromJson(d as Map<String, dynamic>));

  Future<void> cancel(int id, String reason) => _api.post(ApiConstants.meBookingCancel(id), body: {'reason': reason}, parse: (_) {});

  Future<void> uploadPhotos(int id, List<String> paths) => _api.upload(ApiConstants.meBookingAttachments(id), field: 'files', files: paths, parse: (_) {});
}
