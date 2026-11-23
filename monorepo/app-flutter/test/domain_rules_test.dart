import 'package:app_flutter/core/utils/formatters.dart';
import 'package:app_flutter/features/assignments/domain/job_entities.dart';
import 'package:app_flutter/features/auth/domain/auth_entity.dart';
import 'package:app_flutter/features/bookings/domain/booking_entities.dart';
import 'package:app_flutter/features/catalog/domain/catalog_entities.dart';
import 'package:flutter_test/flutter_test.dart';

ServiceItem svc(int id, String type, double price) => ServiceItem(
      id: id,
      code: 'S$id',
      name: 'Service $id',
      categoryId: 1,
      categoryName: 'AC',
      pricingType: type,
      price: price,
      durationMinutes: 60,
      gstApplicable: true,
      gstRate: 18,
    );

void main() {
  group('BookingDraft', () {
    test('estimate counts only priced services', () {
      final d = BookingDraft(type: 'SERVICE')
        ..setQty(svc(1, 'FIXED', 499), 2)
        ..setQty(svc(2, 'QUOTATION', 0), 1)
        ..setQty(svc(3, 'FREE', 0), 1);
      expect(d.estimate, 998);
      expect(d.hasQuotationItems, isTrue);
    });

    test('quantity 0 removes a line and quantity is clamped', () {
      final s = svc(1, 'FIXED', 100);
      final d = BookingDraft(type: 'SERVICE')..setQty(s, 99);
      expect(d.lines[1]!.qty, 50);
      d.setQty(s, 0);
      expect(d.lines, isEmpty);
    });

    test('step validation', () {
      final service = BookingDraft(type: 'SERVICE');
      expect(service.validateStep(0), isNotNull);
      service.setQty(svc(1, 'FIXED', 100), 1);
      expect(service.validateStep(0), isNull);
      expect(service.validateStep(1), isNotNull);
      service.addressId = 5;
      expect(service.validateStep(1), isNull);
      expect(service.validateStep(2), isNotNull);

      final repair = BookingDraft(type: 'REPAIR')..problemDescription = 'no';
      expect(repair.validateStep(0), isNotNull);
      repair.problemDescription = 'AC is not cooling';
      expect(repair.validateStep(0), isNull);
    });

    test('payload formats date and items', () {
      final d = BookingDraft(type: 'SERVICE')
        ..setQty(svc(7, 'FIXED', 100), 2)
        ..addressId = 3
        ..date = DateTime(2026, 3, 9);
      final p = d.toPayload();
      expect(p['scheduledDate'], '2026-03-09');
      expect(p['items'], [
        {'serviceId': 7, 'quantity': 2}
      ]);
    });
  });

  group('Job workflow', () {
    Job job(String status) => Job(id: 1, number: 'LAS', type: 'SERVICE', status: status, assignmentStatus: 'ASSIGNED', scheduledDate: '2026-01-01', customerName: 'A', customerPhone: '+91', address: 'X', items: const []);

    test('next action follows the field sequence', () {
      expect(job('ASSIGNED').nextAction, JobAction.respond);
      expect(job('ACCEPTED').nextAction?.targetStatus, 'ON_THE_WAY');
      expect(job('ON_THE_WAY').nextAction?.targetStatus, 'ARRIVED');
      expect(job('ARRIVED').nextAction?.targetStatus, 'IN_PROGRESS');
      expect(job('IN_PROGRESS').nextAction, JobAction.complete);
      expect(job('COMPLETED').nextAction, isNull);
    });
  });

  group('Role routing', () {
    test('technician vs customer', () {
      const tech = AppUser(id: 1, name: 'Ravi K', mobile: '9', userType: 'STAFF', roles: ['TECHNICIAN'], staffId: 3);
      const cust = AppUser(id: 2, name: 'Anita', mobile: '9', userType: 'CUSTOMER', roles: ['CUSTOMER'], customerId: 4);
      expect(tech.isTechnician, isTrue);
      expect(cust.isTechnician, isFalse);
      expect(cust.isCustomer, isTrue);
      expect(tech.firstName, 'Ravi');
    });
  });

  group('Validators', () {
    test('mobile, pin, password, email', () {
      expect(Validators.mobile('9876543210'), isNull);
      expect(Validators.mobile('1234567890'), isNotNull);
      expect(Validators.pincode('452010'), isNull);
      expect(Validators.pincode('052010'), isNotNull);
      expect(Validators.password('abcdefgh'), isNotNull);
      expect(Validators.password('abcd1234'), isNull);
      expect(Validators.optionalEmail(''), isNull);
      expect(Validators.optionalEmail('bad@'), isNotNull);
      expect(Validators.name('Ñandú José'), isNull);
    });

    test('humanize', () {
      expect(Fmt.humanize('ON_THE_WAY'), 'On The Way');
    });
  });
}
