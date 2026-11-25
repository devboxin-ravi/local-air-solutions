/// Booking UI pieces: booking card, tracking hero, timeline, step indicator. UI only.
library;

import 'package:flutter/material.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../catalog/domain/catalog_entities.dart';
import '../domain/booking_entities.dart';

class BookingCard extends StatelessWidget {
  const BookingCard({super.key, required this.booking, required this.onTap});
  final BookingSummary booking;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final (fg, bg) = StatusColors.of(booking.status);
    final meta = t.bodySmall?.copyWith(fontSize: 12.5);
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(Space.md + 2),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Calendar tile tinted by status
        Container(
          width: 58,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.md + 2)),
          child: Column(children: [
            Text(Fmt.monthAbbr(booking.scheduledDate), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: fg)),
            Text(Fmt.dayOfMonth(booking.scheduledDate), style: const TextStyle(fontSize: 22, height: 1.15, fontWeight: FontWeight.w800, color: AppColors.navy)),
            Text(Fmt.weekdayAbbr(booking.scheduledDate), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
          ]),
        ),
        const SizedBox(width: Space.md + 2),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(booking.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700, fontSize: 15))),
              const SizedBox(width: Space.sm),
              StatusBadge(booking.status),
            ]),
            const SizedBox(height: 4),
            Row(children: [
              Icon(booking.type == 'REPAIR' ? Icons.build_rounded : Icons.ac_unit_rounded, size: 13, color: AppColors.slateLight),
              const SizedBox(width: 4),
              Flexible(child: Text(booking.scheduledTime != null ? '${booking.number}  ·  ${booking.scheduledTime}' : booking.number, maxLines: 1, overflow: TextOverflow.ellipsis, style: meta)),
            ]),
            const SizedBox(height: Space.sm + 2),
            Row(children: [
              if (booking.technicianName != null) ...[
                const Icon(Icons.engineering_rounded, size: 15, color: AppColors.greenDark),
                const SizedBox(width: 4),
                Expanded(child: Text(booking.technicianName!, maxLines: 1, overflow: TextOverflow.ellipsis, style: meta?.copyWith(fontWeight: FontWeight.w600, color: AppColors.navy))),
              ] else
                Expanded(child: Text('Technician to be assigned', style: meta)),
              Text(booking.estimatedTotal > 0 ? Fmt.money(booking.estimatedTotal) : 'On inspection', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.blue)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/// Display copy and icon for each customer-facing tracking step.
class TrackingStep {
  const TrackingStep(this.label, this.short, this.hint, this.icon);
  final String label;

  /// Compact label for the horizontal stepper.
  final String short;
  final String hint;
  final IconData icon;

  static const Map<String, TrackingStep> all = {
    BookingStatus.confirmed: TrackingStep('Booking confirmed', 'Confirmed', 'Your slot is reserved', Icons.event_available_rounded),
    BookingStatus.assigned: TrackingStep('Technician assigned', 'Assigned', 'An expert is matched to your job', Icons.engineering_rounded),
    BookingStatus.onTheWay: TrackingStep('On the way', 'On the way', 'Technician is heading to you', Icons.two_wheeler_rounded),
    BookingStatus.arrived: TrackingStep('Arrived', 'Arrived', 'Technician has reached your place', Icons.home_work_rounded),
    BookingStatus.inProgress: TrackingStep('Work started', 'Working', 'Service is underway', Icons.handyman_rounded),
    BookingStatus.completed: TrackingStep('Completed', 'Done', 'Job done — invoice & warranty ready', Icons.verified_rounded),
  };

  /// Visible steps in booking order, with admin-configured text over the built-in defaults.
  static List<(String, TrackingStep)> resolve(List<TrackerStepConfig> config) => [
        for (final key in BookingStatus.trackingSteps)
          if (_cfg(config, key)?.visible ?? true) (key, _merge(all[key]!, _cfg(config, key))),
      ];

  static TrackerStepConfig? _cfg(List<TrackerStepConfig> config, String key) => config.where((c) => c.status == key).firstOrNull;

  static TrackingStep _merge(TrackingStep d, TrackerStepConfig? c) => c == null
      ? d
      : TrackingStep(c.title.isEmpty ? d.label : c.title, c.label.isEmpty ? d.short : c.label, c.hint, d.icon);

  /// Index of [status] in [BookingStatus.trackingSteps] (−1 when not on the tracking path).
  static int indexOf(String status) => BookingStatus.trackingSteps.indexOf(status == BookingStatus.accepted ? BookingStatus.assigned : status);
}

/// Compact gradient header: booking number, status, service title and date · time.
class BookingHeroCard extends StatelessWidget {
  const BookingHeroCard({super.key, required this.booking});
  final BookingSummary booking;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(Radii.xl), boxShadow: AppShadows.glow(AppColors.blue)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          const DecorBubbles(opacity: 0.07),
          Positioned(right: -12, bottom: -18, child: Icon(booking.type == 'REPAIR' ? Icons.build_circle_outlined : Icons.ac_unit_rounded, size: 96, color: Colors.white.withValues(alpha: 0.08))),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.lg, Space.md, Space.lg, Space.lg),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.confirmation_number_outlined, size: 14, color: Colors.white70),
                const SizedBox(width: 5),
                Expanded(child: Text(booking.number, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: 0.3))),
                _StatusPill(status: booking.status),
              ]),
              const SizedBox(height: Space.sm),
              Text(booking.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.2)),
              const SizedBox(height: Space.sm),
              Row(children: [
                const Icon(Icons.calendar_month_rounded, size: 15, color: Colors.white),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    '${Fmt.dateOnly(booking.scheduledDate)}${booking.scheduledTime != null ? '  ·  ${booking.scheduledTime}' : ''}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                ),
              ]),
            ]),
          ),
        ]),
      );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (fg, _) = StatusColors.of(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.pill)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(Fmt.humanize(status), style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 11.5)),
      ]),
    );
  }
}

/// Horizontal tracker: Confirmed → Assigned → On the way → Arrived → Working → Done,
/// with the current step's detail underneath.
class TrackingTimeline extends StatelessWidget {
  const TrackingTimeline({super.key, required this.status, required this.events, this.config = const []});
  final String status;
  final List<TimelineEvent> events;

  /// Step visibility and wording from the admin panel; empty uses the built-in defaults.
  final List<TrackerStepConfig> config;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    if (status == BookingStatus.cancelled || status == BookingStatus.rejected) {
      return _Notice(icon: Icons.cancel_rounded, color: AppColors.red, background: AppColors.redSoft, text: 'This booking was ${status.toLowerCase()}');
    }
    if (status == BookingStatus.pendingPayment || status == BookingStatus.paymentVerification) {
      return _Notice(
        icon: Icons.hourglass_top_rounded,
        color: AppColors.amber,
        background: AppColors.amberSoft,
        text: status == BookingStatus.pendingPayment ? 'Awaiting payment to confirm your booking' : 'We are verifying your payment',
      );
    }
    final shown = TrackingStep.resolve(config);
    final steps = shown.map((e) => e.$1).toList();
    // A booking at a hidden status stays on the last visible step before it.
    final order = TrackingStep.indexOf(status);
    var reached = -1;
    for (var i = 0; i < steps.length; i++) {
      if (BookingStatus.trackingSteps.indexOf(steps[i]) <= order) reached = i;
    }
    final currentKey = reached >= 0 ? steps[reached] : null;
    final current = reached >= 0 ? shown[reached].$2 : null;
    final ev = currentKey == null ? null : events.where((e) => e.status == currentKey || (currentKey == BookingStatus.assigned && e.status == BookingStatus.accepted)).lastOrNull;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(steps.length, (i) {
          final step = shown[i].$2;
          final done = i < reached || (i == reached && steps[i] == BookingStatus.completed);
          final isCurrent = i == reached && !done;
          Widget line(bool on) => Expanded(child: Container(height: 3, decoration: BoxDecoration(color: on ? AppColors.green : AppColors.track, borderRadius: BorderRadius.circular(2))));
          return Expanded(
            child: Column(children: [
              Row(children: [
                i == 0 ? const Spacer() : line(i <= reached),
                _StepDot(icon: step.icon, done: done, current: isCurrent),
                i == steps.length - 1 ? const Spacer() : line(i < reached),
              ]),
              const SizedBox(height: 6),
              Text(
                step.short,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600, color: isCurrent ? AppColors.blue : (done ? AppColors.navy : AppColors.slateLight)),
              ),
            ]),
          );
        }),
      ),
      if (current != null) ...[
        const SizedBox(height: Space.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm + 2),
          decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(Radii.md)),
          child: Row(children: [
            Icon(current.icon, size: 18, color: AppColors.blue),
            const SizedBox(width: Space.sm),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(current.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: AppColors.navy)),
                Text([current.hint, if (ev != null) Fmt.dateTime(ev.at.toIso8601String())].where((x) => x.isNotEmpty).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(fontSize: 11.5)),
              ]),
            ),
          ]),
        ),
      ],
    ]);
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.icon, required this.done, required this.current});
  final IconData icon;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: Motion.medium,
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: current ? AppColors.ctaGradient : (done ? AppColors.greenGradient : null),
          color: current || done ? null : AppColors.track,
          boxShadow: current ? AppShadows.glow(AppColors.blue) : null,
        ),
        child: Icon(done ? Icons.check_rounded : icon, size: 16, color: current || done ? Colors.white : AppColors.slateLight),
      );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.background, required this.text});
  final IconData icon;
  final Color color;
  final Color background;
  final String text;

  @override
  Widget build(BuildContext context) => Row(children: [
        IconBox(icon, color: color, background: background, size: 38),
        const SizedBox(width: Space.md),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.titleSmall)),
      ]);
}

/// One-line technician row with a call button, or a "being assigned" placeholder.
class TechnicianCard extends StatelessWidget {
  const TechnicianCard({super.key, this.name, this.phone, this.onCall});
  final String? name;

  /// Shown under the name when the admin allows technician phones for customers.
  final String? phone;
  final VoidCallback? onCall;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final assigned = name != null && name!.trim().isNotEmpty;
    return Row(children: [
      Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: assigned ? AppColors.greenGradient : null, color: assigned ? null : AppColors.amberSoft),
        child: assigned
            ? Text(name!.trim()[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800))
            : const Icon(Icons.manage_search_rounded, color: AppColors.amber, size: 20),
      ),
      const SizedBox(width: Space.md),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(assigned ? 'Your technician · Verified' : 'Technician', style: t.bodySmall?.copyWith(fontSize: 11.5)),
          Text(assigned ? name! : 'Will be assigned before your slot', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navy)),
          if (assigned && phone != null && phone!.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: GestureDetector(
                onTap: onCall,
                child: Row(children: [
                  const Icon(Icons.phone_rounded, size: 14, color: AppColors.greenDark),
                  const SizedBox(width: 4),
                  Text(phone!.trim(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.greenDark, letterSpacing: 0.3)),
                ]),
              ),
            ),
        ]),
      ),
      if (onCall != null)
        SizedBox(
          width: 38,
          height: 38,
          child: DecoratedBox(
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppColors.greenGradient),
            child: IconButton(padding: EdgeInsets.zero, onPressed: onCall, icon: const Icon(Icons.call_rounded, color: Colors.white, size: 18), tooltip: 'Call technician'),
          ),
        ),
    ]);
  }
}

/// Compact pill action (icon + label) for the booking action row.
class BookingActionTile extends StatelessWidget {
  const BookingActionTile({super.key, required this.icon, required this.label, required this.onTap, this.color = AppColors.blue, this.background = AppColors.blueSoft});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) => Material(
        color: background,
        borderRadius: BorderRadius.circular(Radii.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.md - 2, horizontal: Space.sm),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 17, color: color),
              const SizedBox(width: 6),
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: color))),
            ]),
          ),
        ),
      );
}

/// Numbered steps joined by a line; finished steps show a tick.
class StepIndicator extends StatelessWidget {
  const StepIndicator({super.key, required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(steps.length, (i) {
          final done = i < current;
          final active = i == current;
          return Expanded(
            child: Column(children: [
              Row(children: [
                Expanded(child: i == 0 ? const SizedBox.shrink() : Container(height: 2.5, color: done || active ? AppColors.blue : AppColors.border)),
                AnimatedContainer(
                  duration: Motion.medium,
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: done || active ? AppColors.ctaGradient : null,
                    color: done || active ? null : AppColors.surface,
                    border: Border.all(color: done || active ? Colors.transparent : AppColors.border, width: 2),
                    boxShadow: active ? AppShadows.glow(AppColors.blue) : null,
                  ),
                  child: done
                      ? const Icon(Icons.check_rounded, size: 17, color: Colors.white)
                      : Text('${i + 1}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: active ? Colors.white : AppColors.slateLight)),
                ),
                Expanded(child: i == steps.length - 1 ? const SizedBox.shrink() : Container(height: 2.5, color: done ? AppColors.blue : AppColors.border)),
              ]),
              const SizedBox(height: 6),
              Text(steps[i], maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active || done ? AppColors.navy : AppColors.slateLight)),
            ]),
          );
        }),
      );
}

/// Compact "your booking" strip for the top of the home screen: live step, date/time, tap to track.
class ActiveBookingStrip extends StatelessWidget {
  const ActiveBookingStrip({super.key, required this.booking, required this.onTap, this.config = const []});
  final BookingSummary booking;
  final VoidCallback onTap;
  final List<TrackerStepConfig> config;

  @override
  Widget build(BuildContext context) {
    final steps = TrackingStep.resolve(config);
    final order = TrackingStep.indexOf(booking.status);
    final current = steps.lastWhere((s) => BookingStatus.trackingSteps.indexOf(s.$1) <= order, orElse: () => steps.first).$2;
    final onPath = order >= 0;
    final when = '${Fmt.dateOnly(booking.scheduledDate)}${booking.scheduledTime != null ? ' · ${booking.scheduledTime}' : ''}';
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(Radii.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Container(
          padding: const EdgeInsets.all(Space.md + 2),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: AppColors.blueSoft, width: 1.5), boxShadow: AppShadows.soft),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppColors.ctaGradient),
              child: Icon(onPath ? current.icon : Icons.hourglass_top_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: Space.md),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(onPath ? current.label : Fmt.humanize(booking.status), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: AppColors.navy)),
                const SizedBox(height: 1),
                Text('${booking.title} · $when', maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 12)),
              ]),
            ),
            const SizedBox(width: Space.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(Radii.pill)),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Text('Track', style: TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800, fontSize: 12.5)),
                SizedBox(width: 2),
                Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.blue),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
