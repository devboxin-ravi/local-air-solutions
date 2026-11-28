/// Payment (UPI submit), invoices, payment history, AMC and reminders screens.
library;

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../bookings/presentation/booking_providers.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../../catalog/presentation/services_screen.dart';
import '../domain/finance_entities.dart';
import 'finance_providers.dart';
import '../data/razorpay_checkout.dart';
import '../../auth/presentation/auth_provider.dart';

/// [startOnline]: open Razorpay checkout as soon as the screen shows (right after booking).
typedef PaymentArgs = ({int? bookingId, int? invoiceId, double amount, String label, bool startOnline});

class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key, required this.args});
  final PaymentArgs args;
  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  final _form = GlobalKey<FormState>();
  final _ref = TextEditingController();
  late final _amount = TextEditingController(text: widget.args.amount.toStringAsFixed(2));
  // One key per screen visit: retries after a network failure cannot create duplicates.
  final String _idempotencyKey = '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
  XFile? _screenshot;
  bool _submitting = false;
  bool _payingOnline = false;

  @override
  void initState() {
    super.initState();
    if (widget.args.startOnline) WidgetsBinding.instance.addPostFrameCallback((_) => _payOnline());
  }

  /// Razorpay: server order → native checkout → server verification.
  Future<void> _payOnline() async {
    if (_payingOnline) return;
    setState(() => _payingOnline = true);
    final repo = ref.read(financeRepositoryProvider);
    try {
      final order = await repo.createRazorpayOrder(bookingId: widget.args.bookingId, invoiceId: widget.args.invoiceId);
      final settings = ref.read(publicSettingsProvider).value;
      final user = ref.read(authControllerProvider).user;
      final result = await RazorpayCheckout().open(
        order,
        businessName: settings?.companyName ?? 'Local Air Solutions',
        description: 'Payment for ${widget.args.label}',
        contact: user?.mobile,
        email: user?.email,
      );
      if (!mounted) return;
      switch (result) {
        case CheckoutSuccess(:final orderId, :final paymentId, :final signature):
          await repo.verifyRazorpay(orderId: orderId, paymentId: paymentId, signature: signature);
          if (widget.args.bookingId != null) ref.invalidate(bookingDetailProvider(widget.args.bookingId!));
          ref.invalidate(paymentsProvider);
          if (!mounted) return;
          showAppSnack(context, Messages.paymentSuccess);
          context.pop();
        case CheckoutFailed(:final message, :final cancelled):
          showAppSnack(context, message, error: !cancelled);
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _payingOnline = false);
    }
  }

  @override
  void dispose() {
    _ref.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await ref.read(financeRepositoryProvider).submitUpi(
            bookingId: widget.args.bookingId,
            invoiceId: widget.args.invoiceId,
            amount: double.parse(_amount.text),
            reference: _ref.text,
            screenshotPath: _screenshot?.path,
            idempotencyKey: _idempotencyKey,
          );
      if (widget.args.bookingId != null) ref.invalidate(bookingDetailProvider(widget.args.bookingId!));
      ref.invalidate(paymentsProvider);
      if (!mounted) return;
      showAppSnack(context, 'Payment submitted — we’ll verify it shortly');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(publicSettingsProvider).value;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Make a payment')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(Space.page), children: [
          AppCard(
            color: AppColors.blueSoft,
            border: false,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Paying for ${widget.args.label}', style: t.bodySmall),
              Text(Fmt.money(widget.args.amount), style: t.headlineMedium?.copyWith(color: AppColors.blue)),
            ]),
          ),
          if (settings?.razorpayEnabled == true) ...[
            const SizedBox(height: Space.xl),
            Text('Pay online', style: t.titleMedium),
            const SizedBox(height: Space.sm),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const IconBox(Icons.credit_card_rounded),
                  const SizedBox(width: Space.md),
                  Expanded(child: Text('Card, UPI, net banking or wallet — confirmed instantly.', style: t.bodyMedium)),
                ]),
                const SizedBox(height: Space.md),
                PrimaryButton(label: 'Pay ${Fmt.money(widget.args.amount)} online', icon: Icons.lock_rounded, color: AppColors.green, loading: _payingOnline, onPressed: _payOnline),
              ]),
            ),
          ],
          if (settings == null || settings.upiEnabled) ...[
          const SizedBox(height: Space.xl),
          if (settings?.razorpayEnabled == true) Text('Or pay by UPI and share the reference', style: t.bodySmall),
          Text('1. Pay using any UPI app', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          if (settings != null && settings.upiId.isNotEmpty)
            AppCard(
              child: Row(children: [
                const IconBox(Icons.qr_code_2_rounded),
                const SizedBox(width: Space.md),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(settings.upiPayeeName, style: t.bodySmall), SelectableText(settings.upiId, style: t.titleSmall)])),
                IconButton(
                  tooltip: 'Copy UPI ID',
                  icon: const Icon(Icons.copy_rounded),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: settings.upiId));
                    showAppSnack(context, 'UPI ID copied');
                  },
                ),
              ]),
            )
          else
            Text('UPI details are shared by our team. Contact support if you need them.', style: t.bodyMedium),
          const SizedBox(height: Space.xl),
          Text('2. Enter the transaction reference', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          TextFormField(controller: _ref, maxLength: 100, decoration: const InputDecoration(labelText: 'UPI reference / UTR number *', counterText: ''), validator: Validators.length(4, 100, label: 'Reference')),
          const SizedBox(height: Space.md),
          TextFormField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Amount paid (₹) *'),
            validator: (v) {
              final n = double.tryParse(v ?? '');
              if (n == null || n <= 0) return 'Enter a valid amount';
              if (n > widget.args.amount + 0.001) return 'Cannot exceed ${Fmt.money(widget.args.amount)}';
              return null;
            },
          ),
          const SizedBox(height: Space.md),
          OutlinedButton.icon(
            onPressed: () async {
              final f = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: Limits.imageQuality, maxWidth: Limits.imageMaxWidth);
              if (f != null) setState(() => _screenshot = f);
            },
            icon: Icon(_screenshot == null ? Icons.image_outlined : Icons.check_circle, color: _screenshot == null ? null : AppColors.green),
            label: Text(_screenshot == null ? 'Attach payment screenshot (optional)' : 'Screenshot attached'),
          ),
          const SizedBox(height: Space.xl),
          PrimaryButton(label: 'Submit for verification', loading: _submitting, onPressed: _submit),
          const SizedBox(height: Space.md),
          Text('Your payment is confirmed once our team verifies the reference.', textAlign: TextAlign.center, style: t.bodySmall),
          ],
        ]),
      ),
    );
  }
}

class InvoicesScreen extends ConsumerWidget {
  const InvoicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(invoicesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: AsyncBody<List<Invoice>>(
        value: value,
        onRetry: () => ref.invalidate(invoicesProvider),
        data: (list) => list.isEmpty
            ? const EmptyView(title: 'No invoices yet', message: 'Invoices appear after a service is completed.', icon: Icons.receipt_long_outlined)
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                itemBuilder: (_, i) {
                  final inv = list[i];
                  return AppCard(
                    onTap: () => context.push(AppRoutes.invoicePath(inv.id)),
                    child: Row(children: [
                      const IconBox(Icons.receipt_long_rounded),
                      const SizedBox(width: Space.md),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(inv.number, style: Theme.of(context).textTheme.titleSmall), Text(Fmt.date(inv.date), style: Theme.of(context).textTheme.bodySmall)])),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Row(mainAxisSize: MainAxisSize.min, children: [Text(Fmt.money(inv.grandTotal), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy)), const SizedBox(width: Space.sm), PaidPill(inv.status)])]),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});
  final int invoiceId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(invoiceProvider(invoiceId));
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Invoice')),
      body: AsyncBody<Invoice>(
        value: value,
        onRetry: () => ref.invalidate(invoiceProvider(invoiceId)),
        data: (inv) => ListView(padding: const EdgeInsets.all(Space.page), children: [
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const BrandLogo(height: 36),
              const SizedBox(height: Space.md),
              Row(children: [
                Expanded(child: Text(Fmt.money(inv.grandTotal), style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.navy))),
                PaidPill(inv.status, large: true),
              ]),
              const SizedBox(height: Space.lg),
              Text(inv.isFreeService ? 'FREE SERVICE INVOICE' : 'INVOICE', style: t.titleMedium),
              Text('${inv.number} · ${Fmt.date(inv.date)}', style: t.bodySmall),
              if (inv.bookingNumber != null) Text('Booking ${inv.bookingNumber}', style: t.bodySmall),
              const Divider(height: Space.xxl),
              ...inv.lines.map((l) => InfoRow(label: '${l.description} × ${l.quantity}', value: Fmt.money(l.amount))),
              const Divider(height: Space.xl),
              InfoRow(label: 'Subtotal', value: Fmt.money(inv.subtotal)),
              if (inv.discount > 0) InfoRow(label: inv.isFreeService ? 'Free service discount' : 'Discount', value: '− ${Fmt.money(inv.discount)}'),
              if (inv.cgst > 0) InfoRow(label: 'CGST', value: Fmt.money(inv.cgst)),
              if (inv.sgst > 0) InfoRow(label: 'SGST', value: Fmt.money(inv.sgst)),
              if (inv.igst > 0) InfoRow(label: 'IGST', value: Fmt.money(inv.igst)),
              if (inv.roundOff > 0) InfoRow(label: 'Round off', value: '+ ${Fmt.money(inv.roundOff)}'),
              InfoRow(label: 'Grand total', value: Fmt.money(inv.grandTotal), bold: true, valueColor: AppColors.blue),
              InfoRow(label: 'Paid', value: Fmt.money(inv.amountPaid), valueColor: AppColors.greenDark),
              InfoRow(label: 'Balance due', value: Fmt.money(inv.balanceDue), bold: true, valueColor: inv.balanceDue > 0 ? AppColors.red : AppColors.greenDark),
            ]),
          ),
          const SizedBox(height: Space.xl),
          if (inv.balanceDue > 0 && inv.status != 'CANCELLED')
            PrimaryButton(label: 'Pay ${Fmt.money(inv.balanceDue)}', color: AppColors.green, icon: Icons.account_balance_wallet_rounded, onPressed: () => context.push(AppRoutes.payment, extra: (bookingId: null, invoiceId: inv.id, amount: inv.balanceDue, label: inv.number, startOnline: false))),
        ]),
      ),
    );
  }
}

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(paymentsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Payments')),
      body: AsyncBody<List<PaymentRecord>>(
        value: value,
        onRetry: () => ref.invalidate(paymentsProvider),
        data: (list) => list.isEmpty
            ? const EmptyView(title: 'No payments yet', icon: Icons.account_balance_wallet_outlined)
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                itemBuilder: (_, i) {
                  final p = list[i];
                  return AppCard(
                    child: Row(children: [
                      IconBox(p.method == 'CASH' ? Icons.payments_outlined : Icons.qr_code_2_rounded, color: AppColors.greenDark, background: AppColors.greenSoft),
                      const SizedBox(width: Space.md),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(Fmt.money(p.amount), style: Theme.of(context).textTheme.titleSmall),
                          Text('${Fmt.humanize(p.method)} · ${p.reference ?? p.number}', style: Theme.of(context).textTheme.bodySmall),
                          if (p.status == 'REJECTED' && p.note != null) Text(p.note!, style: const TextStyle(color: AppColors.red, fontSize: 12)),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [StatusBadge(p.status), const SizedBox(height: 4), Text(Fmt.date(p.date), style: Theme.of(context).textTheme.bodySmall)]),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

class AmcScreen extends ConsumerWidget {
  const AmcScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(amcListProvider);
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: pageAppBar(context, title: 'AMC plans', subtitle: 'Year-round care for your ACs'),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(amcListProvider.future),
        child: AsyncBody<List<AmcContract>>(
          value: value,
          onRetry: () => ref.invalidate(amcListProvider),
          data: (list) => ListView(padding: const EdgeInsets.all(Space.page), children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(Radii.xl),
              child: DecoratedBox(
                decoration: const BoxDecoration(gradient: AppColors.brandGradient),
                child: Stack(children: [
                  const DecorBubbles(opacity: 0.08),
                  Padding(
                    padding: const EdgeInsets.all(Space.xl),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Annual Maintenance Contract', style: t.titleMedium?.copyWith(color: Colors.white, fontSize: 17)),
                            const SizedBox(height: 4),
                            Text('Worry-free cooling all year round.', style: t.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.8))),
                          ]),
                        ),
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: Colors.white.withValues(alpha: 0.25))),
                          child: const Icon(Icons.verified_user_rounded, color: AppColors.green, size: 30),
                        ),
                      ]),
                      const SizedBox(height: Space.lg),
                      for (final (icon, text) in const [
                        (Icons.event_repeat_rounded, 'Scheduled service visits'),
                        (Icons.bolt_rounded, 'Priority support & faster visits'),
                        (Icons.savings_outlined, 'Lower running & repair costs'),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(top: Space.sm),
                          child: Row(children: [
                            Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(color: AppColors.green.withValues(alpha: 0.22), shape: BoxShape.circle),
                              child: Icon(icon, size: 15, color: const Color(0xFFB9E37E)),
                            ),
                            const SizedBox(width: Space.sm + 2),
                            Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5))),
                          ]),
                        ),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: Space.xl),
            if (list.isEmpty)
              EmptyView(title: 'No AMC yet', message: 'Ask our team for an AMC quote for your ACs.', icon: Icons.shield_outlined, action: 'Book AC servicing', onAction: () => startBooking(context, ref))
            else
              ...list.map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: Space.md),
                    child: AppCard(
                      onTap: () => context.push(AppRoutes.amcPath(a.id)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [Expanded(child: Text(a.number, style: t.titleSmall)), StatusBadge(a.status)]),
                        const SizedBox(height: 4),
                        Text(a.productDetails, style: t.bodyMedium),
                        const SizedBox(height: Space.md),
                        ClipRRect(borderRadius: BorderRadius.circular(Radii.pill), child: LinearProgressIndicator(value: a.progress, minHeight: 8, color: AppColors.green, backgroundColor: AppColors.greenSoft)),
                        const SizedBox(height: 6),
                        Row(children: [Text('${a.completedVisits}/${a.totalVisits} visits done', style: t.bodySmall), const Spacer(), Text('Valid till ${Fmt.dateOnly(a.endDate)}', style: t.bodySmall)]),
                      ]),
                    ),
                  )),
          ]),
        ),
      ),
    );
  }
}

class AmcDetailScreen extends ConsumerWidget {
  const AmcDetailScreen({super.key, required this.amcId});
  final int amcId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(amcProvider(amcId));
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('AMC details')),
      body: AsyncBody<AmcContract>(
        value: value,
        onRetry: () => ref.invalidate(amcProvider(amcId)),
        data: (a) => ListView(padding: const EdgeInsets.all(Space.page), children: [
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(a.number, style: t.titleMedium)), StatusBadge(a.status)]),
              const SizedBox(height: Space.sm),
              Text(a.productDetails, style: t.bodyLarge),
              const Divider(height: Space.xl),
              InfoRow(label: 'Period', value: '${Fmt.dateOnly(a.startDate)} – ${Fmt.dateOnly(a.endDate)}'),
              InfoRow(label: 'Visits', value: '${a.completedVisits} of ${a.totalVisits} completed'),
              InfoRow(label: 'Contract value', value: Fmt.money(a.amount)),
              if (a.services.isNotEmpty) Padding(padding: const EdgeInsets.only(top: Space.sm), child: Text('Covers: ${a.services.join(', ')}', style: t.bodyMedium)),
            ]),
          ),
          const SizedBox(height: Space.xl),
          Text('Visit schedule', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          ...a.visits.map((v) => Padding(
                padding: const EdgeInsets.only(bottom: Space.sm),
                child: AppCard(
                  child: Row(children: [
                    CircleAvatar(backgroundColor: AppColors.blueSoft, child: Text('${v.number}', style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800))),
                    const SizedBox(width: Space.md),
                    Expanded(child: Text(Fmt.dateOnly(v.date), style: t.titleSmall)),
                    StatusBadge(v.status),
                  ]),
                ),
              )),
          if (a.visits.isEmpty) Text('Visits are scheduled once the AMC is active.', style: t.bodyMedium),
          if (a.terms != null) ...[const SizedBox(height: Space.xl), Text('Terms', style: t.titleMedium), const SizedBox(height: Space.sm), Text(a.terms!, style: t.bodyMedium)],
        ]),
      ),
    );
  }
}

class RemindersScreen extends ConsumerWidget {
  const RemindersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(remindersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Service reminders')),
      body: AsyncBody<List<Reminder>>(
        value: value,
        onRetry: () => ref.invalidate(remindersProvider),
        data: (list) => list.isEmpty
            ? const EmptyView(title: 'No reminders', message: 'After a service we remind you when the next one is due (every 6 months by default).', icon: Icons.alarm_off_rounded)
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                itemBuilder: (_, i) {
                  final r = list[i];
                  final open = !['COMPLETED', 'DISMISSED'].contains(r.status);
                  return AppCard(
                    child: Row(children: [
                      IconBox(Icons.alarm_rounded, color: open ? AppColors.amber : AppColors.slate, background: open ? AppColors.amberSoft : AppColors.background),
                      const SizedBox(width: Space.md),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(r.title, style: Theme.of(context).textTheme.titleSmall), Text('Due ${Fmt.dateOnly(r.dueDate)}', style: Theme.of(context).textTheme.bodySmall)])),
                      if (open) TextButton(onPressed: () => startBooking(context, ref), child: const Text('Book')) else StatusBadge(r.status),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

/// Payment state for customers, beside the amount: white on blue "Paid", white on red "Unpaid".
class PaidPill extends StatelessWidget {
  const PaidPill(this.status, {super.key, this.large = false});
  final String status;
  final bool large;

  @override
  Widget build(BuildContext context) {
    if (status == 'CANCELLED') return StatusBadge(status);
    final paid = status == 'PAID';
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 14 : 10, vertical: large ? 6 : 3.5),
      decoration: BoxDecoration(color: paid ? AppColors.blue : AppColors.red, borderRadius: BorderRadius.circular(Radii.pill)),
      child: Text(paid ? 'Paid' : 'Unpaid', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: large ? 13 : 11.5)),
    );
  }
}
