/// Booking UI pieces: booking card, tracking timeline, step indicator. UI only.
library;

import 'package:flutter/material.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../domain/booking_entities.dart';

class BookingCard extends StatelessWidget {
  const BookingCard({super.key, required this.booking, required this.onTap});
  final BookingSummary booking;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconBox(booking.type == 'REPAIR' ? Icons.build_rounded : Icons.ac_unit_rounded, size: 40),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(booking.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleSmall),
              Text(booking.number, style: t.bodySmall),
            ]),
          ),
          StatusBadge(booking.status),
        ]),
        const Padding(padding: EdgeInsets.symmetric(vertical: Space.md), child: Divider()),
        Row(children: [
          const Icon(Icons.calendar_today_rounded, size: 15, color: AppColors.slate),
          const SizedBox(width: 6),
          Text(Fmt.dateOnlyShort(booking.scheduledDate), style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.navy)),
          if (booking.scheduledTime != null) Text('  ·  ${booking.scheduledTime}', style: t.bodySmall),
          const Spacer(),
          Text(booking.estimatedTotal > 0 ? Fmt.money(booking.estimatedTotal) : 'On inspection', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy)),
        ]),
        if (booking.technicianName != null) ...[
          const SizedBox(height: Space.sm),
          Row(children: [const Icon(Icons.engineering_rounded, size: 16, color: AppColors.green), const SizedBox(width: 6), Text(booking.technicianName!, style: t.bodySmall?.copyWith(fontWeight: FontWeight.w600))]),
        ],
      ]),
    );
  }
}

/// Confirmed → Technician Assigned → On The Way → Arrived → Work Started → Completed.
class TrackingTimeline extends StatelessWidget {
  const TrackingTimeline({super.key, required this.status, required this.events});
  final String status;
  final List<TimelineEvent> events;

  static const _labels = {
    BookingStatus.confirmed: 'Booking confirmed',
    BookingStatus.assigned: 'Technician assigned',
    BookingStatus.onTheWay: 'On the way',
    BookingStatus.arrived: 'Arrived',
    BookingStatus.inProgress: 'Work started',
    BookingStatus.completed: 'Completed',
  };

  int get _reached {
    const order = BookingStatus.trackingSteps;
    final s = status == BookingStatus.accepted ? BookingStatus.assigned : status;
    final idx = order.indexOf(s);
    return idx;
  }

  @override
  Widget build(BuildContext context) {
    if (status == BookingStatus.cancelled || status == BookingStatus.rejected) {
      return Row(children: [const Icon(Icons.cancel_rounded, color: AppColors.red), const SizedBox(width: Space.sm), Text('This booking was ${status.toLowerCase()}', style: Theme.of(context).textTheme.titleSmall)]);
    }
    if (status == BookingStatus.pendingPayment || status == BookingStatus.paymentVerification) {
      return Row(children: [
        const Icon(Icons.hourglass_top_rounded, color: AppColors.amber),
        const SizedBox(width: Space.sm),
        Expanded(child: Text(status == BookingStatus.pendingPayment ? 'Awaiting payment to confirm your booking' : 'We are verifying your payment', style: Theme.of(context).textTheme.titleSmall)),
      ]);
    }
    final reached = _reached;
    return Column(
      children: List.generate(BookingStatus.trackingSteps.length, (i) {
        final key = BookingStatus.trackingSteps[i];
        final done = i <= reached;
        final current = i == reached;
        final ev = events.where((e) => e.status == key || (key == BookingStatus.assigned && e.status == BookingStatus.accepted)).lastOrNull;
        return IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Column(children: [
              AnimatedContainer(
                duration: Motion.medium,
                width: 24,
                height: 24,
                decoration: BoxDecoration(color: done ? (current && key != BookingStatus.completed ? AppColors.blue : AppColors.green) : Colors.white, shape: BoxShape.circle, border: Border.all(color: done ? Colors.transparent : AppColors.border, width: 2)),
                child: done ? Icon(current && key != BookingStatus.completed ? Icons.radio_button_checked : Icons.check, size: 14, color: Colors.white) : null,
              ),
              if (i < BookingStatus.trackingSteps.length - 1) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 2), color: i < reached ? AppColors.green : AppColors.border)),
            ]),
            const SizedBox(width: Space.md),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: Space.lg),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_labels[key]!, style: TextStyle(fontWeight: current ? FontWeight.w800 : FontWeight.w600, color: done ? AppColors.navy : AppColors.slateLight, fontSize: 14.5)),
                  if (ev != null) Text(Fmt.dateTime(ev.at.toIso8601String()), style: Theme.of(context).textTheme.bodySmall),
                ]),
              ),
            ),
          ]),
        );
      }),
    );
  }
}

class StepIndicator extends StatelessWidget {
  const StepIndicator({super.key, required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) => Row(
        children: List.generate(steps.length, (i) {
          final done = i < current;
          final active = i == current;
          return Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AnimatedContainer(duration: Motion.medium, height: 4, margin: const EdgeInsets.only(right: 4), decoration: BoxDecoration(color: done || active ? AppColors.blue : AppColors.border, borderRadius: BorderRadius.circular(Radii.pill))),
              const SizedBox(height: 6),
              Text(steps[i], maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? AppColors.blue : AppColors.slate)),
            ]),
          );
        }),
      );
}
