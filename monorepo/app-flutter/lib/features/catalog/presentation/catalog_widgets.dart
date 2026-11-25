/// Catalogue UI pieces: service card, category tile, price label. UI only.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../../shared/widgets/appliance_art.dart';
import '../domain/catalog_entities.dart';

String priceText(ServiceItem s) => s.isQuotation
    ? 'Price on inspection'
    : s.isFree
        ? 'Free'
        : '${s.isStarting ? 'From ' : ''}${Fmt.moneyShort(s.price)}';

IconData iconForCategory(String name) {
  final n = name.toLowerCase();
  if (n.contains('install')) return Icons.construction_rounded;
  if (n.contains('repair')) return Icons.build_circle_outlined;
  if (n.contains('maint')) return Icons.cleaning_services_rounded;
  if (n.contains('refrig')) return Icons.kitchen_rounded;
  if (n.contains('electric')) return Icons.electrical_services_rounded;
  if (n.contains('appliance')) return Icons.local_laundry_service_outlined;
  if (n.contains('commercial')) return Icons.apartment_rounded;
  if (n.contains('air') || n.contains('ac')) return Icons.ac_unit_rounded;
  return Icons.handyman_outlined;
}

class ServiceThumb extends StatelessWidget {
  const ServiceThumb({super.key, required this.service, this.size = 64});
  final ServiceItem service;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(gradient: AppColors.freshGradient, borderRadius: BorderRadius.circular(Radii.lg)),
      child: Icon(iconForCategory(service.categoryName), color: AppColors.blue, size: size * 0.45),
    );
    if (service.imageUrl == null || service.imageUrl!.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.lg),
      child: CachedNetworkImage(imageUrl: AppConfig.assetUrl(service.imageUrl!), width: size, height: size, fit: BoxFit.cover, placeholder: (_, __) => fallback, errorWidget: (_, __, ___) => fallback),
    );
  }
}

/// Label shown above the price ("Starts at", "Price"…), or null when the price text says it all.
String? priceCaption(ServiceItem s) => s.isQuotation || s.isFree ? null : (s.isStarting ? 'Starts at' : 'Price');

/// Price amount without the "From" prefix (the caption carries it).
String priceAmount(ServiceItem s) => s.isQuotation ? 'On inspection' : (s.isFree ? 'Free' : Fmt.moneyShort(s.price));

/// Which appliance illustration best represents a service (null → use the category icon).
ApplianceKind? applianceFor(ServiceItem s) {
  final n = '${s.name} ${s.categoryName}'.toLowerCase();
  if (n.contains('wash')) return ApplianceKind.washer;
  if (n.contains('refrig') || n.contains('fridge')) return ApplianceKind.fridge;
  if (n.contains('geyser') || n.contains('water heater')) return ApplianceKind.geyser;
  if (n.contains('window')) return ApplianceKind.windowAc;
  if (n.contains('uninstall') || n.contains('outdoor') || n.contains('gas') || n.contains('compressor') || n.contains('hvac') || n.contains('commercial')) return ApplianceKind.outdoorUnit;
  if (n.contains('ac') || n.contains('air') || n.contains('split')) return ApplianceKind.splitAc;
  return null;
}

/// A bundled photo and the part of it to keep in view when cropped.
typedef ServicePhoto = ({String asset, Alignment focus});

/// Realistic default photo for a service, by what the service is about (null → illustration).
ServicePhoto? photoFor(ServiceItem s) {
  final n = '${s.name} ${s.categoryName}'.toLowerCase();
  if (n.contains('electric') || n.contains('wiring')) return (asset: ServiceImages.electrical, focus: Alignment.center);
  if (n.contains('commercial') || n.contains('hvac')) return (asset: ServiceImages.commercial, focus: const Alignment(-0.6, 0.1));
  if (n.contains('wash')) return (asset: ServiceImages.washerGeyser, focus: const Alignment(-1, 0.72));
  if (n.contains('geyser') || n.contains('water heater')) return (asset: ServiceImages.washerGeyser, focus: const Alignment(-1, -0.5));
  if (n.contains('refrig') || n.contains('fridge')) return (asset: ServiceImages.fridge, focus: const Alignment(0.3, 0.1));
  if (n.contains('window')) return (asset: ServiceImages.windowAc, focus: const Alignment(0, 0.25));
  if (n.contains('repair') || n.contains('gas') || n.contains('leak') || n.contains('compressor')) return (asset: ServiceImages.acRepair, focus: const Alignment(0, 0.1));
  if (n.contains('uninstall') || n.contains('outdoor')) return (asset: ServiceImages.outdoorUnit, focus: Alignment.center);
  if (n.contains('air') || n.contains('split') || n.contains('ac ') || n.endsWith('ac') || n.contains('install') || n.contains('servic') || n.contains('clean')) {
    return (asset: ServiceImages.splitAc, focus: const Alignment(0.25, -0.3));
  }
  return null;
}

/// Service picture: uploaded photo (admin) → bundled photo → drawn illustration.
class ServicePhotoView extends StatelessWidget {
  const ServicePhotoView({super.key, required this.service, required this.fallback, this.width, this.height});
  final ServiceItem service;
  final Widget fallback;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final photo = photoFor(service);
    final local = photo == null ? fallback : Image.asset(photo.asset, width: width, height: height, fit: BoxFit.cover, alignment: photo.focus, errorBuilder: (_, __, ___) => fallback);
    if (service.imageUrl == null || service.imageUrl!.isEmpty) return local;
    return CachedNetworkImage(imageUrl: AppConfig.assetUrl(service.imageUrl!), width: width, height: height, fit: BoxFit.cover, placeholder: (_, __) => local, errorWidget: (_, __, ___) => local);
  }
}

/// Soft background behind each illustration.
const Map<ApplianceKind, List<Color>> _artBackground = {
  ApplianceKind.splitAc: [Color(0xFFE0ECFF), Color(0xFFC7DBFB)],
  ApplianceKind.windowAc: [Color(0xFFEDE9FE), Color(0xFFD9D2FB)],
  ApplianceKind.outdoorUnit: [Color(0xFFEFF3F8), Color(0xFFDCE4EE)],
  ApplianceKind.washer: [Color(0xFFE0F2FE), Color(0xFFC6E6FB)],
  ApplianceKind.fridge: [Color(0xFFECFDF5), Color(0xFFD1F2E2)],
  ApplianceKind.geyser: [Color(0xFFFFF4E5), Color(0xFFFDE3C3)],
};

/// Catalogue card: illustrated tile with a "Popular" badge, category + name + description,
/// duration / GST chips, favourite heart, and a price bar with a "Book Now" button.
class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service, required this.onTap, this.onBook, this.favorite = false, this.onFavorite});
  final ServiceItem service;
  final VoidCallback onTap;
  final VoidCallback? onBook;
  final bool favorite;
  final VoidCallback? onFavorite;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final caption = priceCaption(service);
    return AppCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Stack(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.md, Space.md, Space.md, Space.md),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _ServiceTile(service: service),
              const SizedBox(width: Space.md + 2),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: onFavorite != null ? 36 : 0, top: 2),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(service.categoryName.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.blue)),
                    const SizedBox(height: 3),
                    Text(service.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -0.2)),
                    if (service.description != null && service.description!.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(service.description!.trim(), maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(fontSize: 13, height: 1.35)),
                    ],
                    const SizedBox(height: Space.sm + 2),
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      _MetaChip(icon: Icons.schedule_rounded, label: _duration(service.durationMinutes)),
                      if (service.gstApplicable) const _MetaChip(icon: Icons.receipt_long_rounded, label: 'GST invoice'),
                    ]),
                  ]),
                ),
              ),
            ]),
          ),
          if (onFavorite != null)
            Positioned(top: Space.sm + 2, right: Space.sm + 2, child: _FavoriteButton(favorite: favorite, onPressed: onFavorite!)),
        ]),
        // Price + action bar
        Container(
          padding: const EdgeInsets.fromLTRB(Space.lg, 10, 10, 10),
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [Color(0xFFF8FAFD), Color(0xFFFFF8F3)]),
            border: Border(top: BorderSide(color: AppColors.borderSoft)),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(Radii.lg)),
          ),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                if (caption != null) Text(caption, style: t.bodySmall?.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
                Text(priceAmount(service), style: TextStyle(fontSize: service.isQuotation ? 15 : 20, fontWeight: FontWeight.w800, color: AppColors.navy, letterSpacing: -0.3)),
              ]),
            ),
            Container(width: 1, height: 34, margin: const EdgeInsets.symmetric(horizontal: Space.md), color: AppColors.border),
            if (onBook != null) _BookButton(onPressed: onBook!),
          ]),
        ),
      ]),
    );
  }

  static String _duration(int minutes) {
    if (minutes < 60) return '$minutes min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '$h hr' : '$h hr $m min';
  }
}

/// Illustrated tile (or the service photo) with an optional "Popular" badge.
class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.service});
  final ServiceItem service;

  static const double size = 108;

  @override
  Widget build(BuildContext context) {
    final kind = applianceFor(service);
    final (fg, bg) = AppColors.tintAt(service.categoryId);
    final colors = kind == null ? [bg, Color.lerp(bg, fg, 0.16)!] : _artBackground[kind]!;
    final art = Container(
      width: size,
      height: size * 0.92,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors)),
      child: Stack(children: [
        Positioned(right: -16, bottom: -16, child: Container(width: 60, height: 60, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.4), shape: BoxShape.circle))),
        Center(child: kind == null ? Icon(iconForCategory(service.categoryName), color: fg, size: 42) : ApplianceArt(kind, width: size * 0.86, height: size * 0.66)),
      ]),
    );
    return SizedBox(
      width: size,
      height: size * 0.92,
      child: Stack(clipBehavior: Clip.none, children: [
        ClipRRect(borderRadius: BorderRadius.circular(Radii.lg), child: ServicePhotoView(service: service, fallback: art, width: size, height: size * 0.92)),
        if (service.isPopular)
          Positioned(
            left: -6,
            top: -8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFFB923C), Color(0xFFF97316)]),
                borderRadius: BorderRadius.circular(Radii.pill),
                boxShadow: AppShadows.glow(const Color(0xFFF97316)),
              ),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.local_fire_department_rounded, size: 13, color: Colors.white),
                SizedBox(width: 3),
                Text('Popular', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
              ]),
            ),
          ),
      ]),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.favorite, required this.onPressed});
  final bool favorite;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        shape: const CircleBorder(side: BorderSide(color: AppColors.borderSoft)),
        elevation: 2,
        shadowColor: const Color(0x330F1F3D),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: AnimatedSwitcher(
              duration: Motion.fast,
              transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
              child: Icon(favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded, key: ValueKey(favorite), size: 20, color: favorite ? AppColors.rose : AppColors.slate),
            ),
          ),
        ),
      );
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: AppColors.track, borderRadius: BorderRadius.circular(Radii.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 12, color: AppColors.slate),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.slate)),
        ]),
      );
}

class _BookButton extends StatelessWidget {
  const _BookButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(gradient: AppColors.ctaGradient, borderRadius: BorderRadius.circular(Radii.pill), boxShadow: AppShadows.glow(AppColors.blue)),
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: Colors.white,
            shape: const StadiumBorder(),
            textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
          ),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('Book Now'), SizedBox(width: 4), Icon(Icons.arrow_forward_rounded, size: 15)]),
        ),
      );
}

class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.category, required this.onTap, this.index = 0});
  final Category category;
  final VoidCallback onTap;

  /// Position in the list; picks the tile's colour so neighbouring categories differ.
  final int index;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = AppColors.tintAt(index);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.lg),
      child: Column(children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(Radii.xl),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [BoxShadow(color: fg.withValues(alpha: 0.14), blurRadius: 12, offset: const Offset(0, 5))],
          ),
          child: Icon(iconForCategory(category.name), color: fg, size: 30),
        ),
        const SizedBox(height: Space.sm),
        Text(category.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy, height: 1.2)),
      ]),
    );
  }
}

/// Square filter tile for the services screen's category row ("All Services", categories, "More").
class CategoryFilterTile extends StatelessWidget {
  const CategoryFilterTile({super.key, required this.label, required this.icon, required this.selected, required this.onTap});
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: Motion.medium,
        curve: Motion.curve,
        width: 92,
        decoration: BoxDecoration(
          gradient: selected ? AppColors.ctaGradient : null,
          color: selected ? null : const Color(0xFFEDF2FA),
          borderRadius: BorderRadius.circular(Radii.lg),
          boxShadow: selected ? AppShadows.glow(AppColors.blue) : null,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(Radii.lg),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(icon, size: 30, color: selected ? Colors.white : AppColors.blue),
                const SizedBox(height: 8),
                Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.2, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? Colors.white : AppColors.navy)),
              ]),
            ),
          ),
        ),
      );
}
