/// Reusable UI building blocks: buttons, cards, badges, headers, states, logo.
/// No business logic, no API calls.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_constants.dart';
import '../../core/network/api_client.dart' show ApiException;
import '../../core/utils/formatters.dart';
import '../themes/app_theme.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 44, this.markOnly = false});
  final double height;
  final bool markOnly;

  @override
  Widget build(BuildContext context) => Image.asset(markOnly ? AppConstants.logoMarkAsset : AppConstants.logoAsset, height: height, fit: BoxFit.contain, semanticLabel: 'Local Air Solutions');
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, this.onPressed, this.loading = false, this.icon, this.color});
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    // Gradient fill + coloured glow; stays filled (not greyed) while loading.
    final active = onPressed != null;
    final tone = color ?? AppColors.blue;
    return AnimatedContainer(
      duration: Motion.medium,
      curve: Motion.curve,
      decoration: BoxDecoration(
        gradient: active && color == null ? AppColors.ctaGradient : null,
        color: active && color != null ? color : null,
        borderRadius: BorderRadius.circular(Radii.button),
        boxShadow: active && !loading ? AppShadows.glow(tone) : null,
      ),
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          shadowColor: Colors.transparent,
          disabledBackgroundColor: active ? Colors.transparent : AppColors.border,
          disabledForegroundColor: active ? Colors.white : AppColors.slateLight,
        ),
        child: AnimatedSwitcher(
          duration: Motion.fast,
          child: loading
              ? const SizedBox(key: ValueKey('l'), height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
              : Row(key: const ValueKey('c'), mainAxisSize: MainAxisSize.min, children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: Space.sm)],
                  Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
                ]),
        ),
      ),
    );
  }
}

/// Surface card. White cards float on a soft layered shadow; tinted cards ([color]) sit flat.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(Space.lg), this.onTap, this.color, this.border = true, this.gradient});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final bool border;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(Radii.lg);
    final elevated = gradient == null && (color == null || color == AppColors.surface) && border;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: gradient,
        color: gradient == null ? (color ?? AppColors.surface) : null,
        boxShadow: elevated ? AppShadows.soft : (gradient != null ? AppShadows.glow(AppColors.blue) : null),
        border: elevated ? Border.all(color: AppColors.borderSoft) : null,
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(onTap: onTap, borderRadius: radius, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// Paints soft translucent circles; place inside a [Stack] over a gradient to add depth.
class DecorBubbles extends StatelessWidget {
  const DecorBubbles({super.key, this.opacity = 0.10});
  final double opacity;

  @override
  Widget build(BuildContext context) => Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _BubblePainter(opacity))));
}

class _BubblePainter extends CustomPainter {
  const _BubblePainter(this.opacity);
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()..color = Colors.white.withValues(alpha: opacity);
    final ring = Paint()
      ..color = Colors.white.withValues(alpha: opacity * 1.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawCircle(Offset(size.width * 0.95, size.height * 0.05), size.shortestSide * 0.6, fill);
    canvas.drawCircle(Offset(size.width * 0.80, size.height * 1.0), size.shortestSide * 0.3, fill);
    canvas.drawCircle(Offset(size.width * 0.04, size.height * 0.18), size.shortestSide * 0.24, ring);
  }

  @override
  bool shouldRepaint(_BubblePainter old) => old.opacity != opacity;
}

/// Full-bleed gradient hero used at the top of dashboards and auth screens.
class GradientHeader extends StatelessWidget {
  const GradientHeader({super.key, required this.child, this.gradient = AppColors.brandGradient, this.bottomPadding = Space.xxl});
  final Widget child;
  final Gradient gradient;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(Radii.xxl + 4)),
        child: DecoratedBox(
          decoration: BoxDecoration(gradient: gradient),
          child: Stack(children: [
            const DecorBubbles(),
            Padding(
              padding: EdgeInsets.fromLTRB(Space.page, MediaQuery.paddingOf(context).top + Space.lg, Space.page, bottomPadding),
              child: child,
            ),
          ]),
        ),
      );
}

/// Round translucent icon button for use on gradient headers.
class GlassIconButton extends StatelessWidget {
  const GlassIconButton({super.key, required this.icon, required this.onPressed, this.tooltip, this.badge = 0});
  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
  final int badge;

  @override
  Widget build(BuildContext context) => Badge(
        isLabelVisible: badge > 0,
        label: Text('$badge'),
        backgroundColor: AppColors.green,
        offset: const Offset(-2, 2),
        child: Material(
          color: Colors.white.withValues(alpha: 0.14),
          shape: CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.22))),
          child: IconButton(onPressed: onPressed, tooltip: tooltip, icon: Icon(icon, color: Colors.white)),
        ),
      );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key, this.large = false});
  final String status;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = StatusColors.of(status);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 12 : 9, vertical: large ? 6 : 3.5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.pill)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(Fmt.humanize(status), style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: large ? 13 : 11.5)),
      ]),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction, this.subtitle});
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: Space.md),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: Theme.of(context).textTheme.bodySmall)),
            ]),
          ),
          if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
        ]),
      );
}

class IconBox extends StatelessWidget {
  const IconBox(this.icon, {super.key, this.color = AppColors.blue, this.background = AppColors.blueSoft, this.size = Sizes.iconBox, this.gradient});
  final IconData icon;
  final Color color;
  final Color background;
  final double size;

  /// When set, fills the box with this gradient (pair with a white [color]).
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: gradient == null ? background : null,
          gradient: gradient,
          borderRadius: BorderRadius.circular(size * 0.32),
          boxShadow: gradient == null ? null : AppShadows.glow(gradient!.colors.first),
        ),
        child: Icon(icon, color: color, size: size * 0.5),
      );
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.rows = 4});
  final int rows;

  @override
  // shrinkWrap: safe both as a full-screen body and nested inside another scroll view / sliver list.
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(Space.page),
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows,
        separatorBuilder: (_, __) => const SizedBox(height: Space.md),
        itemBuilder: (_, i) => _Shimmer(height: i == 0 ? 120 : 84),
      );
}

class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.height});
  final double height;
  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
        child: Container(height: widget.height, decoration: BoxDecoration(color: AppColors.borderSoft, borderRadius: BorderRadius.circular(Radii.lg))),
      );
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.title, this.message, this.icon = Icons.inbox_outlined, this.action, this.onAction});
  final String title;
  final String? message;
  final IconData icon;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(Space.xxxl),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 112,
              height: 112,
              decoration: const BoxDecoration(gradient: AppColors.freshGradient, shape: BoxShape.circle),
              child: Center(child: IconBox(icon, size: 60, color: Colors.white, gradient: AppColors.brandGradient)),
            ),
            const SizedBox(height: Space.lg),
            Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            if (message != null) Padding(padding: const EdgeInsets.only(top: Space.xs), child: Text(message!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium)),
            if (action != null) Padding(padding: const EdgeInsets.only(top: Space.lg), child: SizedBox(width: 220, child: PrimaryButton(label: action!, onPressed: onAction))),
          ]),
        ),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(Space.xxxl),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const IconBox(Icons.wifi_off_rounded, color: AppColors.red, background: AppColors.redSoft, size: 64),
            const SizedBox(height: Space.lg),
            Text('Couldn’t load', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: Space.xs),
            Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
            if (onRetry != null) Padding(padding: const EdgeInsets.only(top: Space.lg), child: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again'))),
          ]),
        ),
      );
}

/// User-facing text for a failed load: API messages as-is, anything unexpected as a generic message.
String friendlyError(Object error) => error is ApiException ? error.message : Messages.genericError;

/// Renders an AsyncValue with consistent loading / error / data states.
/// Typed on purpose: Riverpod 3's `when` is an extension method, which a `dynamic` receiver cannot call.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.data, this.onRetry, this.loadingRows = 4});
  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;
  final int loadingRows;

  @override
  Widget build(BuildContext context) => value.when(
        data: data,
        loading: () => LoadingView(rows: loadingRows),
        error: (e, _) => ErrorView(message: friendlyError(e), onRetry: onRetry),
      );
}

class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.bold = false, this.valueColor});
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, fontSize: bold ? 16 : 14, color: valueColor ?? AppColors.navy)),
        ]),
      );
}

class CharCountField extends StatelessWidget {
  const CharCountField({super.key, required this.controller, required this.label, required this.maxLength, this.validator, this.minLines = 3, this.hint});
  final TextEditingController controller;
  final String label;
  final String? hint;
  final int maxLength;
  final int minLines;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        minLines: minLines,
        maxLines: minLines + 3,
        maxLength: maxLength,
        validator: validator,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(labelText: label, hintText: hint, alignLabelWithHint: true),
      );
}

void showAppSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Row(children: [
        Icon(error ? Icons.error_outline : Icons.check_circle_outline, color: error ? const Color(0xFFFCA5A5) : AppColors.green),
        const SizedBox(width: Space.sm),
        Expanded(child: Text(message)),
      ]),
    ));
}

Future<bool> confirmDialog(BuildContext context, {required String title, required String message, String confirm = 'Confirm', bool destructive = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(c, true), style: destructive ? TextButton.styleFrom(foregroundColor: AppColors.red) : null, child: Text(confirm)),
      ],
    ),
  );
  return r ?? false;
}

/// Inline status under a lookup dropdown (states, cities…): spinner while loading,
/// message + retry when the request failed. Renders nothing once data is available.
class LookupStatus extends StatelessWidget {
  const LookupStatus({super.key, required this.loading, required this.failed, required this.onRetry});
  final bool loading;
  final bool failed;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (!loading && !failed) return const SizedBox.shrink();
    final style = Theme.of(context).textTheme.bodySmall;
    return Padding(
      padding: const EdgeInsets.only(top: Space.xs, left: Space.md),
      child: loading
          ? Row(children: [
              const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: Space.sm),
              Text(Messages.loadingList, style: style?.copyWith(color: AppColors.slate)),
            ])
          : Row(children: [
              const Icon(Icons.error_outline, size: 16, color: AppColors.red),
              const SizedBox(width: Space.xs),
              Expanded(child: Text('${Messages.listLoadFailed} ${Messages.networkError}', style: style?.copyWith(color: AppColors.red))),
              TextButton(onPressed: onRetry, child: const Text(Messages.tryAgain)),
            ]),
    );
  }
}
