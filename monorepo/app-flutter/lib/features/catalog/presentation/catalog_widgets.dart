/// Catalogue UI pieces: service card, category tile, price label. UI only.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
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
      decoration: BoxDecoration(gradient: AppColors.freshGradient, borderRadius: BorderRadius.circular(Radii.md)),
      child: Icon(iconForCategory(service.categoryName), color: AppColors.blue, size: size * 0.45),
    );
    if (service.imageUrl == null || service.imageUrl!.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.md),
      child: CachedNetworkImage(imageUrl: service.imageUrl!, width: size, height: size, fit: BoxFit.cover, placeholder: (_, __) => fallback, errorWidget: (_, __, ___) => fallback),
    );
  }
}

class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service, required this.onTap, this.onBook});
  final ServiceItem service;
  final VoidCallback onTap;
  final VoidCallback? onBook;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(Space.md),
      child: Row(children: [
        ServiceThumb(service: service),
        const SizedBox(width: Space.md),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(service.name, style: t.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis)),
              if (service.isPopular) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 16)),
            ]),
            const SizedBox(height: 3),
            Text('${service.durationMinutes} min · ${service.categoryName}', style: t.bodySmall),
            const SizedBox(height: 6),
            Text(priceText(service), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.blue, fontSize: 15)),
          ]),
        ),
        if (onBook != null)
          FilledButton(
            onPressed: onBook,
            style: FilledButton.styleFrom(minimumSize: const Size(72, 40), padding: const EdgeInsets.symmetric(horizontal: 14), backgroundColor: AppColors.green),
            child: const Text('Book'),
          ),
      ]),
    );
  }
}

class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.category, required this.onTap});
  final Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Column(children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: AppColors.border), boxShadow: AppShadows.card),
            child: Icon(iconForCategory(category.name), color: AppColors.blue, size: 30),
          ),
          const SizedBox(height: Space.sm),
          Text(category.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.navy, height: 1.2)),
        ]),
      );
}
