/// Home-screen UI pieces: promo carousel, trust pills, category cards and the
/// "Need a service today?" card. UI only — callbacks out, no API or business logic.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../../shared/widgets/appliance_art.dart';
import '../../catalog/domain/catalog_entities.dart';

/// Illustration shown on the right of a promo slide.
enum PromoArt { featured, splitAc, outdoorUnit, repair }

/// One slide of the promo carousel.
class PromoSlide {
  const PromoSlide({
    required this.tag,
    required this.title,
    required this.subtitle,
    required this.cta,
    required this.onTap,
    this.art = PromoArt.splitAc,
    this.accent = AppColors.greenDark,
    this.background = const [Color(0xFFE6F4D7), Color(0xFFF3F9EA), Color(0xFFFFFFFF)],
  });

  final String tag;

  /// First word on line one; the rest is drawn in [accent] on line two ("Summer-ready / **AC Service**").
  final String title;
  final String subtitle;
  final String cta;
  final PromoArt art;
  final Color accent;
  final List<Color> background;
  final VoidCallback onTap;
}

/// Swipeable promo banners with page dots; advances on its own every few seconds.
class PromoCarousel extends StatefulWidget {
  const PromoCarousel({super.key, required this.slides});
  final List<PromoSlide> slides;

  @override
  State<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<PromoCarousel> {
  static const Duration _interval = Duration(seconds: 5);
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _restartTimer();
  }

  void _restartTimer() {
    _timer?.cancel();
    if (widget.slides.length < 2) return;
    _timer = Timer.periodic(_interval, (_) {
      if (!_controller.hasClients) return;
      final next = (_page + 1) % widget.slides.length;
      _controller.animateToPage(next, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slides.isEmpty) return const SizedBox.shrink();
    return Container(
      height: 214,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.xl), boxShadow: AppShadows.soft, border: Border.all(color: Colors.white, width: 1.5)),
      child: Stack(children: [
        NotificationListener<ScrollStartNotification>(
          // A manual swipe resets the auto-advance countdown.
          onNotification: (n) {
            if (n.dragDetails != null) _restartTimer();
            return false;
          },
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.slides.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (_, i) => _PromoSlideView(slide: widget.slides[i]),
          ),
        ),
        if (widget.slides.length > 1)
          Positioned(
            bottom: 12,
            left: 0,
            right: 0,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < widget.slides.length; i++)
                AnimatedContainer(
                  duration: Motion.medium,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 7,
                  height: 7,
                  decoration: BoxDecoration(color: i == _page ? widget.slides[_page].accent : AppColors.slateLight.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(Radii.pill)),
                ),
            ]),
          ),
      ]),
    );
  }
}

class _PromoSlideView extends StatelessWidget {
  const _PromoSlideView({required this.slide});
  final PromoSlide slide;

  @override
  Widget build(BuildContext context) {
    final words = slide.title.trim().split(RegExp(r'\s+'));
    final lead = words.first;
    final rest = words.skip(1).join(' ');
    return LayoutBuilder(builder: (context, box) {
      final featured = slide.art == PromoArt.featured;
      final artWidth = box.maxWidth * (featured ? 0.5 : 0.56);
      final textRight = box.maxWidth * (featured ? 0.47 : 0.42);
      return DecoratedBox(
        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: slide.background)),
        child: Stack(children: [
          // Soft glow behind the illustration
          Positioned(
            right: -artWidth * 0.15,
            top: -box.maxHeight * 0.1,
            child: Container(
              width: artWidth * 1.1,
              height: artWidth * 1.1,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [Colors.white.withValues(alpha: 0.9), Colors.white.withValues(alpha: 0)])),
            ),
          ),
          Positioned(right: 0, top: 0, bottom: 0, width: artWidth, child: _PromoIllustration(art: slide.art, accent: slide.accent)),
          Padding(
            padding: EdgeInsets.fromLTRB(Space.xl, Space.lg, textRight, Space.xl),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.92), borderRadius: BorderRadius.circular(Radii.pill), boxShadow: AppShadows.card),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(color: slide.accent, shape: BoxShape.circle),
                    child: const Icon(Icons.eco_rounded, size: 13, color: Colors.white),
                  ),
                  const SizedBox(width: 6),
                  Flexible(child: Text(slide.tag, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppColors.navy))),
                ]),
              ),
              const Spacer(),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: lead, style: const TextStyle(color: Color(0xFF3F4A5A))),
                    if (rest.isNotEmpty) TextSpan(text: '\n$rest', style: TextStyle(color: slide.accent)),
                  ]),
                  style: const TextStyle(fontSize: 24, height: 1.1, fontWeight: FontWeight.w800, letterSpacing: -0.5),
                ),
              ),
              const SizedBox(height: 6),
              Text(slide.subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, height: 1.35, color: Color(0xFF3F4A5A), fontWeight: FontWeight.w500)),
              const Spacer(),
              FilledButton(
                onPressed: slide.onTap,
                style: FilledButton.styleFrom(
                  backgroundColor: slide.accent,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  shape: const StadiumBorder(),
                  elevation: 2,
                  shadowColor: slide.accent.withValues(alpha: 0.4),
                  textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
                child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [Flexible(child: Text(slide.cta, maxLines: 1, overflow: TextOverflow.ellipsis)), const SizedBox(width: 8), const Icon(Icons.arrow_forward_rounded, size: 18)]),
              ),
            ]),
          ),
        ]),
      );
    });
  }
}

/// Right-hand illustration: the appliance plus floating leaves and a leafy plant in the corner.
class _PromoIllustration extends StatelessWidget {
  const _PromoIllustration({required this.art, required this.accent});
  final PromoArt art;
  final Color accent;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        if (art == PromoArt.featured) {
          // Artwork already includes the AC, airflow, leaves and plant; fade its left edge into the card.
          return ShaderMask(
            shaderCallback: (r) => const LinearGradient(colors: [Colors.transparent, Colors.black], stops: [0, 0.28]).createShader(r),
            blendMode: BlendMode.dstIn,
            child: Image.asset(AppConstants.bannerFeaturedAsset, width: w, height: h, fit: BoxFit.cover, alignment: Alignment.centerRight, filterQuality: FilterQuality.high),
          );
        }
        return Stack(clipBehavior: Clip.none, children: [
          // Appliance
          Positioned(
            right: -w * 0.04,
            top: h * 0.12,
            child: switch (art) {
              PromoArt.splitAc => SplitAcShowcase(width: w * 1.02, height: h * 0.8),
              PromoArt.outdoorUnit => Padding(padding: EdgeInsets.only(right: w * 0.12, top: h * 0.02), child: ApplianceArt(ApplianceKind.outdoorUnit, width: w * 0.8, height: h * 0.66)),
              PromoArt.repair || PromoArt.featured => SplitAcShowcase(width: w * 1.02, height: h * 0.8),
            },
          ),
          if (art == PromoArt.repair)
            Positioned(
              left: w * 0.12,
              top: h * 0.08,
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: accent, shape: BoxShape.circle, boxShadow: AppShadows.glow(accent), border: Border.all(color: Colors.white, width: 3)),
                child: const Icon(Icons.build_rounded, color: Colors.white, size: 22),
              ),
            ),
          // Floating leaves
          Positioned(top: h * 0.03, right: w * 0.12, child: const _Leaf(size: 30, angle: -0.5)),
          Positioned(top: h * 0.62, left: w * 0.1, child: const _Leaf(size: 22, angle: 0.9)),
          // Plant in the corner
          const Positioned(right: -6, bottom: -10, child: _Plant(size: 78)),
        ]);
      });
}

class _Leaf extends StatelessWidget {
  const _Leaf({required this.size, required this.angle});
  final double size;
  final double angle;

  @override
  Widget build(BuildContext context) => Transform.rotate(
        angle: angle,
        child: ShaderMask(
          shaderCallback: (r) => const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFA3D65C), Color(0xFF4D7C1E)]).createShader(r),
          child: Icon(Icons.eco_rounded, size: size, color: Colors.white),
        ),
      );
}

/// A small cluster of leaves, darker at the base, like a pot plant peeking into the corner.
class _Plant extends StatelessWidget {
  const _Plant({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: Stack(clipBehavior: Clip.none, children: [
          for (final (dx, dy, a, s) in const [(0.05, 0.3, -1.1, 0.62), (0.3, 0.0, -0.4, 0.7), (0.5, 0.25, 0.35, 0.62), (0.15, 0.45, -0.7, 0.55), (0.45, 0.5, 0.9, 0.5)])
            Positioned(
              left: size * dx,
              top: size * dy,
              child: Transform.rotate(
                angle: a,
                child: ShaderMask(
                  shaderCallback: (r) => const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF7CB342), Color(0xFF2E5E1A)]).createShader(r),
                  child: Icon(Icons.eco_rounded, size: size * s, color: Colors.white),
                ),
              ),
            ),
        ]),
      );
}

/// Row of three white trust pills (icon + two-line label).
class TrustPills extends StatelessWidget {
  const TrustPills({super.key, required this.points});
  final List<String> points;

  static const List<IconData> _icons = [Icons.engineering_outlined, Icons.verified_user_outlined, Icons.receipt_long_outlined];

  @override
  Widget build(BuildContext context) => Row(children: [
        for (final (i, point) in points.take(3).indexed) ...[
          if (i > 0) const SizedBox(width: Space.sm),
          Expanded(
            child: Container(
              height: 58,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(Radii.lg), boxShadow: AppShadows.soft),
              child: Row(children: [
                Icon(_icons[i % _icons.length], size: 24, color: AppColors.blue),
                const SizedBox(width: 8),
                Expanded(child: Text(point, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, height: 1.2, fontWeight: FontWeight.w700, color: AppColors.navy))),
              ]),
            ),
          ),
        ],
      ]);
}

/// White category card with a tinted icon circle (home grid).
class CategoryGridCard extends StatelessWidget {
  const CategoryGridCard({super.key, required this.label, required this.icon, required this.tint, required this.onTap});
  final String label;
  final IconData icon;
  final (Color, Color) tint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = tint;
    // Shadow on the outer container, ripple on a transparent Material, so the card stays pure white.
    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(Radii.xl), border: Border.all(color: AppColors.borderSoft), boxShadow: AppShadows.soft),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.xl),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
            child: Column(children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(color: bg, shape: BoxShape.circle, boxShadow: [BoxShadow(color: fg.withValues(alpha: 0.12), blurRadius: 10, offset: const Offset(0, 4))]),
                child: Icon(icon, color: fg, size: 28),
              ),
              const Spacer(),
              Text(label,
                  textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, height: 1.2, fontWeight: FontWeight.w700, color: AppColors.navy)),
              const Spacer(),
            ]),
          ),
        ),
      ),
    );
  }
}

/// "Need a Service Today?" call-to-action card.
class ServiceTodayCard extends StatelessWidget {
  const ServiceTodayCard({super.key, required this.config, required this.onBook});
  final TodayCardConfig config;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(Space.lg, Space.lg, Space.md, Space.lg),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Colors.white, Color(0xFFEAF2FD)], begin: Alignment.centerLeft, end: Alignment.centerRight),
          borderRadius: BorderRadius.circular(Radii.xl),
          border: Border.all(color: Colors.white, width: 1.5),
          boxShadow: AppShadows.soft,
        ),
        child: Row(children: [
          const IconBox(Icons.event_note_rounded, size: 50),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(config.title, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: AppColors.navy, letterSpacing: -0.2)),
              if (config.subtitle.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(config.subtitle, style: const TextStyle(fontSize: 12, height: 1.3, color: AppColors.blue, fontWeight: FontWeight.w500)),
              ],
            ]),
          ),
          const SizedBox(width: Space.sm),
          DecoratedBox(
            decoration: BoxDecoration(gradient: AppColors.ctaGradient, borderRadius: BorderRadius.circular(Radii.pill), boxShadow: AppShadows.glow(AppColors.blue)),
            child: FilledButton(
              onPressed: onBook,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 42),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: const StadiumBorder(),
                textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [Text(config.buttonText), const SizedBox(width: 4), const Icon(Icons.arrow_forward_rounded, size: 18)]),
            ),
          ),
        ]),
      );
}
