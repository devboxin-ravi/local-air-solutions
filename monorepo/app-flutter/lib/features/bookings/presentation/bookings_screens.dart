/// Bookings tab (upcoming/past), booking tracking detail and booking confirmation.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/launcher.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../catalog/presentation/services_screen.dart';
import '../domain/booking_entities.dart';
import 'booking_providers.dart';
import 'booking_widgets.dart';

class BookingsScreen extends ConsumerWidget {
  const BookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('My bookings'),
            bottom: const TabBar(tabs: [Tab(text: 'Upcoming'), Tab(text: 'Past')], labelStyle: TextStyle(fontWeight: FontWeight.w700), indicatorColor: AppColors.blue, labelColor: AppColors.blue),
          ),
          body: const TabBarView(children: [_BookingList(tab: 'upcoming'), _BookingList(tab: 'past')]),
        ),
      );
}

class _BookingList extends ConsumerWidget {
  const _BookingList({required this.tab});
  final String tab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(myBookingsProvider(tab));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(myBookingsProvider(tab).future),
      child: AsyncBody<List<BookingSummary>>(
        value: value,
        onRetry: () => ref.invalidate(myBookingsProvider(tab)),
        data: (list) => list.isEmpty
            ? ListView(children: [
                const SizedBox(height: 80),
                EmptyView(
                  title: tab == 'upcoming' ? 'No upcoming bookings' : 'No past bookings',
                  message: tab == 'upcoming' ? 'Book a service and track it here.' : 'Completed and cancelled bookings appear here.',
                  icon: Icons.event_note_outlined,
                  action: tab == 'upcoming' ? 'Book a service' : null,
                  onAction: () => startBooking(context, ref),
                ),
              ])
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.md),
                itemBuilder: (_, i) => BookingCard(booking: list[i], onTap: () => context.push(AppRoutes.bookingPath(list[i].id))),
              ),
      ),
    );
  }
}

class BookingDetailScreen extends ConsumerWidget {
  const BookingDetailScreen({super.key, required this.bookingId});
  final int bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(bookingDetailProvider(bookingId));
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Track booking')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(bookingDetailProvider(bookingId).future),
        child: AsyncBody<BookingDetail>(
          value: value,
          onRetry: () => ref.invalidate(bookingDetailProvider(bookingId)),
          data: (b) {
            final s = b.summary;
            final unpaidInvoice = b.invoices.where((i) => i.balance > 0 && i.status != 'CANCELLED').firstOrNull;
            final canPayPrepaid = s.status == BookingStatus.pendingPayment && s.estimatedTotal > 0;
            return ListView(padding: const EdgeInsets.all(Space.page), children: [
              Container(
                padding: const EdgeInsets.all(Space.xl),
                decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(Radii.xl), boxShadow: AppShadows.raised),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(s.number, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600))),
                    Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.pill)), child: Text(Fmt.humanize(s.status), style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800, fontSize: 12))),
                  ]),
                  const SizedBox(height: Space.sm),
                  Text(s.title, style: t.titleLarge?.copyWith(color: Colors.white)),
                  const SizedBox(height: Space.md),
                  Row(children: [
                    const Icon(Icons.event_rounded, color: Colors.white70, size: 18),
                    const SizedBox(width: 6),
                    Text('${Fmt.dateOnly(s.scheduledDate)}${s.scheduledTime != null ? '  ·  ${s.scheduledTime}' : ''}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  ]),
                ]),
              ),
              const SizedBox(height: Space.lg),
              if (b.technicianName != null)
                AppCard(
                  child: Row(children: [
                    const IconBox(Icons.engineering_rounded, color: AppColors.greenDark, background: AppColors.greenSoft),
                    const SizedBox(width: Space.md),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Your technician', style: t.bodySmall), Text(b.technicianName!, style: t.titleSmall)])),
                    if (b.technicianPhone != null) IconButton.filledTonal(onPressed: () => Launcher.call(b.technicianPhone!), icon: const Icon(Icons.call_rounded), tooltip: 'Call technician'),
                  ]),
                ),
              if (b.technicianName != null) const SizedBox(height: Space.lg),
              AppCard(child: TrackingTimeline(status: s.status, events: b.timeline)),
              const SizedBox(height: Space.lg),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Details', style: t.titleMedium),
                  const SizedBox(height: Space.sm),
                  ...b.items.map((i) => InfoRow(label: '${i.serviceName} × ${i.quantity}', value: i.lineTotal > 0 ? Fmt.money(i.lineTotal) : 'On inspection')),
                  if (b.items.isEmpty) Text(s.title, style: t.bodyMedium),
                  const Divider(height: Space.xl),
                  InfoRow(label: 'Estimated', value: s.estimatedTotal > 0 ? Fmt.money(s.estimatedTotal) : 'On inspection', bold: true),
                  InfoRow(label: 'Payment', value: Fmt.humanize(s.paymentStatus)),
                  const SizedBox(height: Space.sm),
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.location_on_outlined, size: 18, color: AppColors.green), const SizedBox(width: 6), Expanded(child: Text(b.address, style: t.bodyMedium))]),
                ]),
              ),
              if (b.invoices.isNotEmpty) ...[
                const SizedBox(height: Space.lg),
                ...b.invoices.map((i) => Padding(
                      padding: const EdgeInsets.only(bottom: Space.sm),
                      child: AppCard(
                        onTap: () => context.push(AppRoutes.invoicePath(i.id)),
                        child: Row(children: [
                          const IconBox(Icons.receipt_long_rounded),
                          const SizedBox(width: Space.md),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(i.number, style: t.titleSmall), Text('Total ${Fmt.money(i.total)} · Due ${Fmt.money(i.balance)}', style: t.bodySmall)])),
                          StatusBadge(i.status),
                        ]),
                      ),
                    )),
              ],
              if (b.photos.isNotEmpty) ...[
                const SizedBox(height: Space.lg),
                Text('Photos', style: t.titleMedium),
                const SizedBox(height: Space.sm),
                SizedBox(
                  height: 96,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: b.photos.length,
                    separatorBuilder: (_, __) => const SizedBox(width: Space.sm),
                    itemBuilder: (_, i) => ClipRRect(borderRadius: BorderRadius.circular(Radii.md), child: Image.network(AppConfig.assetUrl(b.photos[i].path), width: 96, height: 96, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 96, color: AppColors.border))),
                  ),
                ),
              ],
              const SizedBox(height: Space.xl),
              if (canPayPrepaid || unpaidInvoice != null)
                PrimaryButton(
                  label: 'Pay ${Fmt.money(unpaidInvoice?.balance ?? s.estimatedTotal)}',
                  icon: Icons.account_balance_wallet_rounded,
                  color: AppColors.green,
                  onPressed: () => context.push(AppRoutes.payment, extra: (bookingId: s.id, invoiceId: unpaidInvoice?.id, amount: unpaidInvoice?.balance ?? s.estimatedTotal, label: unpaidInvoice?.number ?? s.number)),
                ),
              if (BookingStatus.customerCancellable.contains(s.status)) ...[
                const SizedBox(height: Space.sm),
                OutlinedButton.icon(onPressed: () => _addPhotos(context, ref, s.id), icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Add photos of the problem')),
                const SizedBox(height: Space.sm),
                TextButton(onPressed: () => _cancel(context, ref, s.id), style: TextButton.styleFrom(foregroundColor: AppColors.red), child: const Text('Cancel booking')),
              ],
            ]);
          },
        ),
      ),
    );
  }

  Future<void> _addPhotos(BuildContext context, WidgetRef ref, int id) async {
    // Images are compressed on-device (quality + max width) before upload.
    final files = await ImagePicker().pickMultiImage(imageQuality: Limits.imageQuality, maxWidth: Limits.imageMaxWidth, limit: Limits.maxPhotos);
    if (files.isEmpty) return;
    try {
      await ref.read(bookingRepositoryProvider).uploadPhotos(id, files.map((f) => f.path).toList());
      ref.invalidate(bookingDetailProvider(id));
      if (context.mounted) showAppSnack(context, 'Photos uploaded');
    } on ApiException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    }
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref, int id) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: TextField(controller: reason, maxLength: Limits.notesMax, decoration: const InputDecoration(labelText: 'Reason'), minLines: 2, maxLines: 4),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep booking')), TextButton(onPressed: () => Navigator.pop(c, true), style: TextButton.styleFrom(foregroundColor: AppColors.red), child: const Text('Cancel booking'))],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(bookingRepositoryProvider).cancel(id, reason.text.trim().length >= 3 ? reason.text.trim() : 'Cancelled by customer');
      ref.invalidate(bookingDetailProvider(id));
      ref.invalidate(myBookingsProvider);
      if (context.mounted) showAppSnack(context, 'Booking cancelled');
    } on ApiException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    }
  }
}

class BookingSuccessScreen extends StatelessWidget {
  const BookingSuccessScreen({super.key, required this.booking});
  final BookingSummary? booking;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Space.page),
          child: Column(children: [
            const Spacer(),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 600),
              curve: Curves.elasticOut,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Container(width: 120, height: 120, decoration: const BoxDecoration(color: AppColors.greenSoft, shape: BoxShape.circle), child: const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 84)),
            ),
            const SizedBox(height: Space.xxl),
            Text(booking?.status == BookingStatus.pendingPayment ? 'Booking received!' : 'Booking confirmed!', style: t.headlineMedium, textAlign: TextAlign.center),
            const SizedBox(height: Space.sm),
            Text(booking == null ? '' : '${booking!.number}\n${Fmt.dateOnly(booking!.scheduledDate)}${booking!.scheduledTime != null ? ' · ${booking!.scheduledTime}' : ''}', textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: AppColors.slate)),
            const SizedBox(height: Space.md),
            Text('We’ll notify you when a technician is assigned.', textAlign: TextAlign.center, style: t.bodyMedium),
            const Spacer(),
            if (booking != null) PrimaryButton(label: 'Track booking', icon: Icons.near_me_rounded, onPressed: () => context.go(AppRoutes.bookingPath(booking!.id))),
            const SizedBox(height: Space.sm),
            OutlinedButton(onPressed: () => context.go(AppRoutes.home), child: const Text('Back to home')),
          ]),
        ),
      ),
    );
  }
}
