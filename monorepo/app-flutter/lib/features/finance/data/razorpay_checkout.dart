/// Razorpay Checkout (native SDK) wrapped as a single Future.
///
/// The order is created on the server first (amount is never trusted from the app); this only opens
/// the payment sheet and hands back the ids + signature for the server to verify.
library;

import 'dart:async';

import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/constants/app_constants.dart';
import '../domain/finance_entities.dart';

/// What the customer did in the payment sheet.
sealed class CheckoutResult {
  const CheckoutResult();
}

class CheckoutSuccess extends CheckoutResult {
  const CheckoutSuccess({required this.orderId, required this.paymentId, required this.signature});
  final String orderId;
  final String paymentId;
  final String signature;
}

class CheckoutFailed extends CheckoutResult {
  const CheckoutFailed(this.message, {this.cancelled = false});
  final String message;

  /// True when the customer closed the sheet — not an error worth alarming about.
  final bool cancelled;
}

class RazorpayCheckout {
  /// Opens the sheet for [order] and completes when the customer pays, fails or closes it.
  Future<CheckoutResult> open(RazorpayOrder order, {required String businessName, required String description, String? contact, String? email}) {
    final razorpay = Razorpay();
    final done = Completer<CheckoutResult>();
    void finish(CheckoutResult r) {
      if (!done.isCompleted) done.complete(r);
      razorpay.clear();
    }

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) {
      finish(CheckoutSuccess(orderId: r.orderId ?? order.orderId, paymentId: r.paymentId ?? '', signature: r.signature ?? ''));
    });
    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) {
      final cancelled = r.code == Razorpay.PAYMENT_CANCELLED;
      finish(CheckoutFailed(cancelled ? Messages.paymentCancelled : (r.message?.isNotEmpty == true ? r.message! : Messages.paymentFailed), cancelled: cancelled));
    });
    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse _) {
      // External wallets complete outside the sheet; the server webhook settles the order.
      finish(const CheckoutFailed(Messages.paymentExternalWallet));
    });

    razorpay.open({
      'key': order.keyId,
      'order_id': order.orderId,
      'amount': (order.amount * 100).round(), // paise
      'currency': order.currency,
      'name': businessName,
      'description': description,
      'prefill': {if (contact != null) 'contact': contact, if (email != null && email.isNotEmpty) 'email': email},
      'retry': {'enabled': true, 'max_count': 2},
    });
    return done.future;
  }
}
