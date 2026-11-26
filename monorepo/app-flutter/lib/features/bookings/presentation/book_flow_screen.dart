/// Booking flow: (1) services / problem → (2) address → (3) date & slot → (4) review & payment.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../account/domain/account_entities.dart';
import '../../account/presentation/account_providers.dart';
import '../../account/presentation/address_form_sheet.dart';
import '../../catalog/domain/catalog_entities.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../../catalog/presentation/catalog_widgets.dart';
import 'booking_providers.dart';
import 'booking_widgets.dart';

class BookFlowScreen extends ConsumerWidget {
  const BookFlowScreen({super.key});

  static const _steps = ['Details', 'Address', 'Schedule', 'Review'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flow = ref.watch(bookingFlowProvider);
    final ctrl = ref.read(bookingFlowProvider.notifier);
    final draft = flow.draft;
    final last = flow.step == BookingFlowController.lastStep;

    return PopScope(
      canPop: flow.step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) ctrl.back();
      },
      child: Scaffold(
        appBar: AppBar(title: Text(draft.isRepair ? 'Request a repair' : 'Book a service')),
        body: Column(children: [
          Padding(padding: const EdgeInsets.fromLTRB(Space.page, Space.sm, Space.page, Space.lg), child: StepIndicator(steps: _steps, current: flow.step)),
          Expanded(
            child: AnimatedSwitcher(
              duration: Motion.medium,
              transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: SlideTransition(position: Tween(begin: const Offset(0.04, 0), end: Offset.zero).animate(anim), child: child)),
              child: KeyedSubtree(
                key: ValueKey(flow.step),
                child: switch (flow.step) {
                  0 => const _DetailsStep(),
                  1 => const _AddressStep(),
                  2 => const _ScheduleStep(),
                  _ => const _ReviewStep(),
                },
              ),
            ),
          ),
        ]),
        bottomNavigationBar: SafeArea(
          child: Container(
            padding: const EdgeInsets.fromLTRB(Space.page, Space.md, Space.page, Space.md),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.border))),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (flow.error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: Space.sm),
                  child: Row(children: [const Icon(Icons.info_outline, color: AppColors.red, size: 18), const SizedBox(width: 6), Expanded(child: Text(flow.error!, style: const TextStyle(color: AppColors.red, fontWeight: FontWeight.w600)))]),
                ),
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text('Estimated', style: Theme.of(context).textTheme.bodySmall),
                    Text(draft.estimate > 0 ? Fmt.money(draft.estimate) : (draft.hasQuotationItems ? 'On inspection' : Fmt.money(0)), style: Theme.of(context).textTheme.titleLarge?.copyWith(color: AppColors.blue)),
                  ]),
                ),
                SizedBox(
                  width: 180,
                  child: PrimaryButton(
                    label: last ? 'Confirm booking' : 'Continue',
                    loading: flow.submitting,
                    onPressed: () async {
                      if (!last) {
                        ctrl.next();
                        return;
                      }
                      final payOnline = flow.draft.paymentMethod == 'RAZORPAY';
                      final amount = flow.draft.estimate;
                      final created = await ctrl.submit();
                      if (created == null || !context.mounted) return;
                      final router = GoRouter.of(context);
                      router.go(AppRoutes.bookingSuccess, extra: created);
                      // Chose "Pay online": open checkout on top of the confirmation screen.
                      if (payOnline) unawaited(router.push(AppRoutes.payment, extra: (bookingId: created.id, invoiceId: null, amount: amount, label: created.number, startOnline: true)));
                    },
                  ),
                ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DetailsStep extends ConsumerStatefulWidget {
  const _DetailsStep();
  @override
  ConsumerState<_DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends ConsumerState<_DetailsStep> {
  late final TextEditingController _problem;
  late final TextEditingController _category;

  @override
  void initState() {
    super.initState();
    final d = ref.read(bookingFlowProvider).draft;
    _problem = TextEditingController(text: d.problemDescription)..addListener(() => ref.read(bookingFlowProvider).draft.problemDescription = _problem.text);
    _category = TextEditingController(text: d.problemCategory);
  }

  @override
  void dispose() {
    _problem.dispose();
    _category.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(bookingFlowProvider);
    final draft = flow.draft;
    final ctrl = ref.read(bookingFlowProvider.notifier);
    final products = ref.watch(productsProvider);
    final services = ref.watch(allServicesProvider);
    final t = Theme.of(context).textTheme;

    return ListView(padding: const EdgeInsets.symmetric(horizontal: Space.page), children: [
      Text('Product', style: t.titleMedium),
      const SizedBox(height: Space.sm),
      Wrap(
        spacing: Space.sm,
        runSpacing: Space.sm,
        children: (products.value ?? const <Product>[])
            .map((p) => ChoiceChip(
                  label: Text(p.name),
                  selected: draft.productId == p.id,
                  onSelected: (on) {
                    draft.productId = on ? p.id : null;
                    ctrl.touch();
                  },
                ))
            .toList(),
      ),
      if (draft.isRepair) ...[
        const SizedBox(height: Space.xl),
        Text('What’s the problem?', style: t.titleMedium),
        const SizedBox(height: Space.sm),
        Wrap(
          spacing: Space.sm,
          runSpacing: Space.sm,
          children: ['Not cooling', 'Water leakage', 'Not starting', 'Noise', 'Gas issue', 'Electrical', 'Other']
              .map((c) => ChoiceChip(
                    label: Text(c),
                    selected: draft.problemCategory == c,
                    onSelected: (on) {
                      draft.problemCategory = on ? c : '';
                      ctrl.touch();
                    },
                  ))
              .toList(),
        ),
        const SizedBox(height: Space.lg),
        CharCountField(controller: _problem, label: 'Describe the problem *', hint: 'e.g. Indoor unit dripping water since yesterday', maxLength: Limits.descriptionMax, minLines: 4),
      ],
      const SizedBox(height: Space.xl),
      SectionHeader(draft.isRepair ? 'Add known services (optional)' : 'Choose services', subtitle: draft.isRepair ? 'Our technician will quote after inspection.' : null),
      services.when(
        data: (list) => Column(
          children: list.map((s) {
            final qty = draft.lines[s.id]?.qty ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: Space.sm),
              child: AnimatedContainer(
                duration: Motion.medium,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: qty > 0 ? AppColors.blue : Colors.transparent, width: 1.5)),
                child: AppCard(
                  padding: const EdgeInsets.all(Space.sm + 2),
                  child: Row(children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(Radii.md),
                      child: ServicePhotoView(service: s, width: 64, height: 64, fallback: ServiceThumb(service: s, size: 64)),
                    ),
                    const SizedBox(width: Space.md),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: 3),
                        Text(priceText(s), style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.w800, fontSize: 14)),
                        Text('${s.durationMinutes} min', style: t.bodySmall),
                      ]),
                    ),
                    qty == 0
                        ? FilledButton.tonalIcon(
                            onPressed: () => ctrl.setQty(s, 1),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('Add'),
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(0, 40),
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              backgroundColor: AppColors.blueSoft,
                              foregroundColor: AppColors.blue,
                              shape: const StadiumBorder(),
                              textStyle: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                          )
                        : _QtyStepper(qty: qty, onChanged: (q) => ctrl.setQty(s, q)),
                  ]),
                ),
              ),
            );
          }).toList(),
        ),
        loading: () => const LoadingView(rows: 3),
        error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(allServicesProvider)),
      ),
      const SizedBox(height: Space.xl),
    ]);
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.qty, required this.onChanged});
  final int qty;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.md), border: Border.all(color: AppColors.blue)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(visualDensity: VisualDensity.compact, onPressed: () => onChanged(qty - 1), icon: const Icon(Icons.remove, size: 18), tooltip: 'Decrease'),
          Text('$qty', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.blue)),
          IconButton(visualDensity: VisualDensity.compact, onPressed: () => onChanged(qty + 1), icon: const Icon(Icons.add, size: 18), tooltip: 'Increase'),
        ]),
      );
}

class _AddressStep extends ConsumerWidget {
  const _AddressStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingFlowProvider).draft;
    final ctrl = ref.read(bookingFlowProvider.notifier);
    final addresses = ref.watch(addressesProvider);
    return AsyncBody<List<Address>>(
      value: addresses,
      onRetry: () => ref.invalidate(addressesProvider),
      data: (items) {
        if (draft.addressId == null && items.isNotEmpty) {
          final def = items.firstWhere((a) => a.isDefault, orElse: () => items.first);
          draft.addressId = def.id;
        }
        return ListView(padding: const EdgeInsets.symmetric(horizontal: Space.page), children: [
          Text('Where should we come?', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Space.md),
          ...items.map((a) => Padding(
                padding: const EdgeInsets.only(bottom: Space.sm),
                child: AppCard(
                  onTap: () {
                    draft.addressId = a.id;
                    draft.slot = null;
                    ctrl.touch();
                  },
                  color: draft.addressId == a.id ? AppColors.blueSoft : null,
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(draft.addressId == a.id ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.blue),
                    const SizedBox(width: Space.md),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${a.label}${a.isDefault ? ' · Default' : ''}', style: Theme.of(context).textTheme.titleSmall),
                        const SizedBox(height: 2),
                        Text(a.full, style: Theme.of(context).textTheme.bodyMedium),
                        if (a.serviceAreaName == null) const Padding(padding: EdgeInsets.only(top: 4), child: Text('Outside mapped service areas — we’ll confirm availability', style: TextStyle(color: AppColors.amber, fontSize: 12, fontWeight: FontWeight.w600))),
                      ]),
                    ),
                  ]),
                ),
              )),
          const SizedBox(height: Space.sm),
          OutlinedButton.icon(onPressed: () => showAddressSheet(context, ref), icon: const Icon(Icons.add_location_alt_outlined), label: const Text('Add new address')),
        ]);
      },
    );
  }
}

class _ScheduleStep extends ConsumerStatefulWidget {
  const _ScheduleStep();
  @override
  ConsumerState<_ScheduleStep> createState() => _ScheduleStepState();
}

class _ScheduleStepState extends ConsumerState<_ScheduleStep> {
  late final TextEditingController _notes;

  @override
  void initState() {
    super.initState();
    _notes = TextEditingController(text: ref.read(bookingFlowProvider).draft.instructions)..addListener(() => ref.read(bookingFlowProvider).draft.instructions = _notes.text);
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingFlowProvider).draft;
    final ctrl = ref.read(bookingFlowProvider.notifier);
    final branches = ref.watch(addressBranchesProvider).value ?? const [];
    final branchId = branches.where((b) => b.addressId == draft.addressId).map((b) => b.branchId).firstOrNull;
    final today = DateTime.now();
    final days = List.generate(14, (i) => DateTime(today.year, today.month, today.day + i));
    final slots = (draft.date != null && branchId != null) ? ref.watch(slotsProvider((branchId: branchId, date: Fmt.ymd(draft.date!)))) : null;
    final t = Theme.of(context).textTheme;

    return ListView(padding: const EdgeInsets.symmetric(horizontal: Space.page), children: [
      Text('Pick a date', style: t.titleMedium),
      const SizedBox(height: Space.md),
      SizedBox(
        height: 84,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: days.length,
          separatorBuilder: (_, __) => const SizedBox(width: Space.sm),
          itemBuilder: (_, i) {
            final d = days[i];
            final sel = draft.date != null && DateUtils.isSameDay(draft.date, d);
            return InkWell(
              borderRadius: BorderRadius.circular(Radii.md),
              onTap: () {
                draft.date = d;
                draft.slot = null;
                ctrl.touch();
              },
              child: AnimatedContainer(
                duration: Motion.fast,
                width: 64,
                decoration: BoxDecoration(color: sel ? AppColors.blue : Colors.white, borderRadius: BorderRadius.circular(Radii.md), border: Border.all(color: sel ? AppColors.blue : AppColors.border)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(i == 0 ? 'Today' : i == 1 ? 'Tmrw' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.weekday - 1], style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white70 : AppColors.slate)),
                  const SizedBox(height: 2),
                  Text('${d.day}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: sel ? Colors.white : AppColors.navy)),
                ]),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: Space.xl),
      Text('Choose a time slot', style: t.titleMedium),
      const SizedBox(height: Space.md),
      if (draft.date == null)
        Text('Select a date to see available slots.', style: t.bodyMedium)
      else if (branchId == null)
        Text('Slots will be confirmed by our team for this address.', style: t.bodyMedium)
      else
        slots!.when(
          data: (list) => list.isEmpty
              ? Text('No open slots on this day — we’ll schedule the best available time.', style: t.bodyMedium)
              : Wrap(
                  spacing: Space.sm,
                  runSpacing: Space.sm,
                  children: list
                      .map((s) => ChoiceChip(
                            label: Text('${s.label}  ·  ${s.available} left'),
                            selected: draft.slot?.id == s.id,
                            onSelected: (on) {
                              draft.slot = on ? s : null;
                              ctrl.touch();
                            },
                          ))
                      .toList(),
                ),
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => Text('$e', style: const TextStyle(color: AppColors.red)),
        ),
      const SizedBox(height: Space.xl),
      CharCountField(controller: _notes, label: 'Instructions for the technician', hint: 'Gate code, parking, best time to call…', maxLength: Limits.notesMax, minLines: 2),
    ]);
  }
}

class _ReviewStep extends ConsumerWidget {
  const _ReviewStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingFlowProvider).draft;
    final ctrl = ref.read(bookingFlowProvider.notifier);
    final settings = ref.watch(publicSettingsProvider).value;
    final address = (ref.watch(addressesProvider).value ?? const []).where((a) => a.id == draft.addressId).firstOrNull;
    final t = Theme.of(context).textTheme;
    final methods = <(String, String, IconData)>[
      if (settings == null || settings.cashEnabled) ('CASH', 'Pay after service (cash/UPI to technician)', Icons.payments_outlined),
      if (settings?.upiEnabled ?? true) ('UPI_MANUAL', 'Pay via UPI & share reference', Icons.qr_code_2_rounded),
      // Online payment needs a known amount (repairs priced after inspection pay later).
      if (settings?.razorpayEnabled == true && draft.estimate > 0) ('RAZORPAY', 'Pay online now (card / UPI / net banking)', Icons.credit_card_rounded),
    ];
    if (!methods.any((m) => m.$1 == draft.paymentMethod) && methods.isNotEmpty) draft.paymentMethod = methods.first.$1;

    return ListView(padding: const EdgeInsets.symmetric(horizontal: Space.page), children: [
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(draft.isRepair ? 'Repair request' : 'Services', style: t.titleMedium),
          const SizedBox(height: Space.sm),
          if (draft.isRepair) Text(draft.problemDescription, style: t.bodyMedium),
          ...draft.lines.values.map((l) => InfoRow(label: '${l.service.name} × ${l.qty}', value: l.service.billablePrice > 0 ? Fmt.money(l.service.billablePrice * l.qty) : priceText(l.service))),
          const Divider(height: Space.xl),
          InfoRow(label: 'Estimated total', value: draft.estimate > 0 ? Fmt.money(draft.estimate) : 'On inspection', bold: true, valueColor: AppColors.blue),
          Text('GST is added on the final invoice where applicable.', style: t.bodySmall),
        ]),
      ),
      const SizedBox(height: Space.md),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [const Icon(Icons.event_available_rounded, color: AppColors.green), const SizedBox(width: Space.sm), Text(draft.date == null ? '—' : Fmt.dateOnly(draft.date!.toIso8601String()), style: t.titleSmall), if (draft.slot != null) Text('  ·  ${draft.slot!.label}', style: t.bodyMedium)]),
          const SizedBox(height: Space.md),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.location_on_outlined, color: AppColors.green), const SizedBox(width: Space.sm), Expanded(child: Text(address?.full ?? '—', style: t.bodyMedium))]),
        ]),
      ),
      const SizedBox(height: Space.xl),
      Text('Payment', style: t.titleMedium),
      const SizedBox(height: Space.sm),
      if (settings?.prepaidRequired == true) Padding(padding: const EdgeInsets.only(bottom: Space.sm), child: Text('Bookings are confirmed after payment is verified.', style: t.bodySmall?.copyWith(color: AppColors.amber, fontWeight: FontWeight.w600))),
      ...methods.map((m) => Padding(
            padding: const EdgeInsets.only(bottom: Space.sm),
            child: AppCard(
              onTap: () {
                draft.paymentMethod = m.$1;
                ctrl.touch();
              },
              color: draft.paymentMethod == m.$1 ? AppColors.blueSoft : null,
              child: Row(children: [
                Icon(draft.paymentMethod == m.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.blue),
                const SizedBox(width: Space.md),
                Icon(m.$3, color: AppColors.navy),
                const SizedBox(width: Space.sm),
                Expanded(child: Text(m.$2, style: t.titleSmall)),
              ]),
            ),
          )),
      const SizedBox(height: Space.xl),
    ]);
  }
}
