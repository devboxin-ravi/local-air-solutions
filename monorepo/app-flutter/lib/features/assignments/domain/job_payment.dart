/// Pay-after-service: what is due on a job and the UPI link behind the technician's QR.
library;

class UpiAccount {
  const UpiAccount({required this.key, required this.label, required this.upiId, required this.payeeName});

  final int key;
  final String label;
  final String upiId;
  final String payeeName;

  /// Standard UPI deep link carrying the exact amount; any UPI app can scan it.
  String paymentLink({required double amount, required String note}) {
    final query = {'pa': upiId, 'pn': payeeName, 'am': amount.toStringAsFixed(2), 'cu': 'INR', 'tn': note};
    return 'upi://pay?${query.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
  }
}

class JobPayment {
  const JobPayment({
    required this.bookingNumber,
    required this.amountDue,
    required this.pendingVerification,
    required this.canCollect,
    required this.upiEnabled,
    required this.cashEnabled,
    required this.accounts,
    this.invoiceNumber,
    this.defaultAccount,
  });

  final String bookingNumber;
  final String? invoiceNumber;
  final double amountDue;

  /// Already recorded but not yet verified by the office.
  final double pendingVerification;
  final bool canCollect;
  final bool upiEnabled;
  final bool cashEnabled;
  final List<UpiAccount> accounts;
  final int? defaultAccount;

  /// Nothing to show when there is neither money due nor money awaiting verification.
  bool get isRelevant => canCollect || pendingVerification > 0;

  UpiAccount? account(int? key) {
    for (final a in accounts) {
      if (a.key == key) return a;
    }
    return accounts.isEmpty ? null : accounts.first;
  }
}
