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

/// Tab-screen app bar: large bold title with an optional one-line subtitle.
/// Used by every bottom-navigation tab so they share one look.
PreferredSizeWidget pageAppBar(BuildContext context, {required String title, String? subtitle, List<Widget>? actions, PreferredSizeWidget? bottom}) {
  final t = Theme.of(context).textTheme;
  return AppBar(
    toolbarHeight: subtitle == null ? 64 : 76,
    automaticallyImplyLeading: false,
    title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, style: t.headlineSmall?.copyWith(fontSize: 24, letterSpacing: -0.4)),
      if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle, style: t.bodySmall?.copyWith(fontSize: 13))),
    ]),
    actions: [...?actions, const SizedBox(width: Space.sm)],
    bottom: bottom,
  );
}

/// Pill-style segmented tabs on a soft track (drives the nearest DefaultTabController).
class SegmentedTabs extends StatelessWidget implements PreferredSizeWidget {
  const SegmentedTabs({super.key, required this.labels});
  final List<String> labels;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(Space.page, Space.xs, Space.page, Space.md),
        child: Container(
          height: 44,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: AppColors.track, borderRadius: BorderRadius.circular(Radii.pill)),
          child: TabBar(tabs: [for (final l in labels) Tab(text: l, height: 36)]),
        ),
      );
}

/// Gradient identity card at the top of profile screens.
class ProfileHeaderCard extends StatelessWidget {
  const ProfileHeaderCard({super.key, required this.initials, required this.name, this.lines = const [], this.badge, this.onEdit, this.avatarUrl, this.onAvatarTap});
  final String initials;
  final String name;
  final List<String> lines;
  final String? badge;
  final VoidCallback? onEdit;

  /// Profile picture; initials show when null or while it loads.
  final String? avatarUrl;

  /// Tapping the picture (camera badge) to change it.
  final VoidCallback? onAvatarTap;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(Radii.xl),
        child: DecoratedBox(
          decoration: const BoxDecoration(gradient: AppColors.brandGradient),
          child: Stack(children: [
            const DecorBubbles(opacity: 0.08),
            Padding(
              padding: const EdgeInsets.all(Space.xl),
              child: Row(children: [
                _Avatar(initials: initials, url: avatarUrl, onTap: onAvatarTap),
                const SizedBox(width: Space.lg),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
                    for (final l in lines) Text(l, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13.5)),
                    if (badge != null) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(Radii.pill), border: Border.all(color: Colors.white.withValues(alpha: 0.25))),
                        child: Text(badge!, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 0.3)),
                      ),
                    ],
                  ]),
                ),
                if (onEdit != null) GlassIconButton(icon: Icons.edit_outlined, onPressed: onEdit!, tooltip: 'Edit profile'),
              ]),
            ),
          ]),
        ),
      );
}

/// Round profile picture with an initials fallback and an optional camera badge.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials, this.url, this.onTap});
  final String initials;
  final String? url;
  final VoidCallback? onTap;

  static const double _size = 70;

  @override
  Widget build(BuildContext context) {
    final fallback = Center(child: Text(initials, style: const TextStyle(color: AppColors.blue, fontSize: 26, fontWeight: FontWeight.w800)));
    final circle = Container(
      width: _size,
      height: _size,
      clipBehavior: Clip.antiAlias,
      // No ring: the photo fills the whole circle; white only sits behind the initials.
      decoration: BoxDecoration(
        color: url == null ? Colors.white : Colors.transparent,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: url == null ? fallback : Image.network(url!, fit: BoxFit.cover, width: _size, height: _size, errorBuilder: (_, __, ___) => fallback, loadingBuilder: (_, child, p) => p == null ? child : fallback),
    );
    if (onTap == null) return circle;
    return Semantics(
      button: true,
      label: 'Change profile picture',
      child: GestureDetector(
        onTap: onTap,
        child: Stack(clipBehavior: Clip.none, children: [
          circle,
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(color: AppColors.green, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
              child: const Icon(Icons.photo_camera_rounded, size: 14, color: Colors.white),
            ),
          ),
        ]),
      ),
    );
  }
}

/// One row in a [MenuGroup].
class MenuEntry {
  const MenuEntry({required this.icon, required this.label, required this.onTap, this.subtitle, this.tint, this.destructive = false, this.trailing});
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  /// Icon colours (foreground, background); defaults to brand blue.
  final (Color, Color)? tint;
  final bool destructive;
  final Widget? trailing;
}

/// Settings-style grouped list: optional caption, white card, tinted icon boxes, chevrons.
class MenuGroup extends StatelessWidget {
  const MenuGroup({super.key, required this.items, this.title});
  final List<MenuEntry> items;
  final String? title;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(left: Space.xs, bottom: Space.sm),
            child: Text(title!.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: AppColors.slate)),
          ),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (var i = 0; i < items.length; i++) ...[
              _MenuRow(item: items[i], first: i == 0, last: i == items.length - 1),
              if (i < items.length - 1) const Divider(indent: 68, endIndent: Space.lg),
            ],
          ]),
        ),
      ]);
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.item, required this.first, required this.last});
  final MenuEntry item;
  final bool first;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = item.destructive ? (AppColors.red, AppColors.redSoft) : (item.tint ?? (AppColors.blue, AppColors.blueSoft));
    final radius = BorderRadius.vertical(top: Radius.circular(first ? Radii.lg : 0), bottom: Radius.circular(last ? Radii.lg : 0));
    return InkWell(
      onTap: item.onTap,
      borderRadius: radius,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: 12),
        child: Row(children: [
          IconBox(item.icon, size: 38, color: fg, background: bg),
          const SizedBox(width: Space.md + 2),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: item.destructive ? AppColors.red : AppColors.navy)),
              if (item.subtitle != null) Text(item.subtitle!, style: Theme.of(context).textTheme.bodySmall),
            ]),
          ),
          item.trailing ?? (item.destructive ? const SizedBox.shrink() : const Icon(Icons.chevron_right_rounded, color: AppColors.slateLight)),
        ]),
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
