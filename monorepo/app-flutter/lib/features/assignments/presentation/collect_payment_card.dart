/// Job screen card and sheet for pay-after-service: UPI QR with the exact amount, or cash.
library;

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../domain/job_payment.dart';
import 'job_providers.dart';

class CollectPaymentCard extends ConsumerWidget {
  const CollectPaymentCard({super.key, required this.jobId});
  final int jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payment = ref.watch(jobPaymentProvider(jobId)).value;
    if (payment == null || !payment.isRelevant) return const SizedBox.shrink();
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: Space.lg),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Payment', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          if (payment.pendingVerification > 0) Text('${Fmt.money(payment.pendingVerification)} recorded — waiting for office verification.', style: t.bodyMedium),
          if (payment.canCollect) ...[
            Text('To collect: ${Fmt.money(payment.amountDue)}', style: t.headlineSmall),
            if (payment.invoiceNumber == null) Text('Includes GST. Invoice not generated yet.', style: t.bodySmall),
            const SizedBox(height: Space.md),
            PrimaryButton(
              label: 'Collect payment',
              icon: Icons.qr_code_2_rounded,
              color: AppColors.greenDark,
              onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _CollectSheet(jobId: jobId, payment: payment)),
            ),
          ],
        ]),
      ),
    );
  }
}

class _CollectSheet extends ConsumerStatefulWidget {
  const _CollectSheet({required this.jobId, required this.payment});
  final int jobId;
  final JobPayment payment;

  @override
  ConsumerState<_CollectSheet> createState() => _CollectSheetState();
}

class _CollectSheetState extends ConsumerState<_CollectSheet> {
  final _reference = TextEditingController();
  late int? _account = widget.payment.defaultAccount;

  /// One key per sheet, so a retry after a network drop cannot record the money twice.
  final String _key = 'job-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _reference.dispose();
    super.dispose();
  }

  Future<void> _record(String method) async {
    if (method == 'UPI_MANUAL' && _reference.text.trim().isEmpty) {
      setState(() => _error = 'Enter the UPI reference number shown after payment.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(jobActionsProvider).collect(widget.jobId, method: method, account: _account, reference: _reference.text, idempotencyKey: '$_key-$method');
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppSnack(context, 'Payment recorded. The office will verify it.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final payment = widget.payment;
    final t = Theme.of(context).textTheme;
    final account = payment.upiEnabled ? payment.account(_account) : null;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(Space.page, Space.page, Space.page, MediaQuery.viewInsetsOf(context).bottom + Space.page),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Collect ${Fmt.money(payment.amountDue)}', style: t.titleLarge, textAlign: TextAlign.center),
        if (account != null) ...[
          const SizedBox(height: Space.md),
          if (payment.accounts.length > 1)
            Wrap(
              alignment: WrapAlignment.center,
              spacing: Space.sm,
              children: [for (final a in payment.accounts) ChoiceChip(label: Text(a.label), selected: a.key == account.key, onSelected: (_) => setState(() => _account = a.key))],
            ),
          Center(child: QrImageView(data: account.paymentLink(amount: payment.amountDue, note: payment.bookingNumber), size: 220, backgroundColor: Colors.white)),
          Text('Ask the customer to scan with any UPI app\n${account.upiId}', style: t.bodySmall, textAlign: TextAlign.center),
          const SizedBox(height: Space.md),
          TextField(controller: _reference, maxLength: 100, decoration: const InputDecoration(labelText: 'UPI reference / UTR number', counterText: '')),
          const SizedBox(height: Space.sm),
          PrimaryButton(label: 'Record UPI payment', icon: Icons.check_rounded, loading: _busy, onPressed: () => _record('UPI_MANUAL')),
        ],
        if (payment.cashEnabled) ...[
          const SizedBox(height: Space.sm),
          OutlinedButton.icon(onPressed: _busy ? null : () => _record('CASH'), icon: const Icon(Icons.payments_outlined), label: const Text('Received in cash')),
        ],
        if (_error != null) Padding(padding: const EdgeInsets.only(top: Space.sm), child: Text(_error!, style: t.bodyMedium?.copyWith(color: AppColors.red), textAlign: TextAlign.center)),
      ]),
    );
  }
}
