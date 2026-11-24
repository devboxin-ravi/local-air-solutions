/// Customer home: greeting, address, promo banner, search, categories, popular services,
/// repair CTA, AMC, upcoming booking, reminders and support.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../account/presentation/account_providers.dart';
import '../../auth/presentation/auth_provider.dart';
import '../../bookings/domain/booking_entities.dart';
import '../../bookings/presentation/booking_widgets.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../../catalog/presentation/catalog_widgets.dart';
import '../../catalog/presentation/services_screen.dart';
import '../../notifications/presentation/notifications_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final addresses = ref.watch(addressesProvider).value ?? const [];
    final defaultAddress = addresses.where((a) => a.isDefault).firstOrNull ?? addresses.firstOrNull;
    final home = ref.watch(homeSummaryProvider);
    final cats = ref.watch(categoriesProvider);
    final popular = ref.watch(popularServicesProvider);
    final unread = ref.watch(unreadCountProvider);
    final settings = ref.watch(publicSettingsProvider).value;
    final showBanner = settings?.bannerEnabled ?? true;
    final announcement = settings?.announcement ?? '';
    final t = Theme.of(context).textTheme;
    final hour = DateTime.now().hour;
    final greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(popularServicesProvider);
          ref.invalidate(addressesProvider);
          ref.invalidate(notificationsProvider);
          final _ = await ref.refresh(homeSummaryProvider.future);
        },
        child: CustomScrollView(slivers: [
          SliverToBoxAdapter(
            child: GradientHeader(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.md), boxShadow: AppShadows.raised),
                    child: const BrandLogo(height: 30, markOnly: true),
                  ),
                  const SizedBox(width: Space.md),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('$greet 👋', style: TextStyle(color: Colors.white.withValues(alpha: 0.78), fontSize: 13, fontWeight: FontWeight.w500)),
                      Text(user?.firstName ?? 'there', maxLines: 1, overflow: TextOverflow.ellipsis, style: t.headlineSmall?.copyWith(color: Colors.white)),
                    ]),
                  ),
                  GlassIconButton(icon: Icons.notifications_none_rounded, tooltip: 'Notifications', badge: unread, onPressed: () => context.push(AppRoutes.notifications)),
                ]),
                const SizedBox(height: Space.lg),
                // Service address as a translucent "glass" chip.
                Material(
                  color: Colors.white.withValues(alpha: 0.12),
                  shape: StadiumBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.2))),
                  child: InkWell(
                    onTap: () => context.push(AppRoutes.addresses),
                    customBorder: const StadiumBorder(),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm),
                      child: Row(children: [
                        const Icon(Icons.location_on_rounded, color: AppColors.green, size: 18),
                        const SizedBox(width: 6),
                        Expanded(child: Text(defaultAddress?.full ?? 'Add your service address', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5))),
                        const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(height: Space.lg),
                Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(Radii.button),
                  elevation: 0,
                  child: InkWell(
                    onTap: () => context.go(AppRoutes.services),
                    borderRadius: BorderRadius.circular(Radii.button),
                    child: Container(
                      height: 54,
                      padding: const EdgeInsets.only(left: Space.lg, right: 6),
                      child: Row(children: [
                        const Icon(Icons.search_rounded, color: AppColors.blue),
                        const SizedBox(width: Space.sm),
                        const Expanded(child: Text('Search for AC service, repair…', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: AppColors.slateLight, fontSize: 14.5))),
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(gradient: AppColors.ctaGradient, borderRadius: BorderRadius.circular(Radii.md)),
                          child: const Icon(Icons.tune_rounded, color: Colors.white, size: 20),
                        ),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(Space.page, Space.xl, Space.page, 0),
            sliver: SliverList.list(children: [
              if (announcement.isNotEmpty) ...[
                AppCard(
                  color: AppColors.amberSoft,
                  border: false,
                  child: Row(children: [
                    const Icon(Icons.campaign_rounded, color: AppColors.amber),
                    const SizedBox(width: Space.md),
                    Expanded(child: Text(announcement, style: t.bodyMedium?.copyWith(color: AppColors.navy, fontWeight: FontWeight.w600))),
                  ]),
                ),
                const SizedBox(height: Space.lg),
              ],
              // Promo banner (content managed in Admin → Settings → Customer App Home)
              if (showBanner) Container(
                constraints: const BoxConstraints(minHeight: 160),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(gradient: AppColors.greenGradient, borderRadius: BorderRadius.circular(Radii.xl), boxShadow: AppShadows.glow(AppColors.greenDark)),
                child: Stack(children: [
                  const DecorBubbles(opacity: 0.12),
                  Positioned(right: -14, bottom: -22, child: Icon(Icons.ac_unit_rounded, size: 150, color: Colors.white.withValues(alpha: 0.22))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(Space.xl, Space.xl, 110, Space.xl),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(Radii.pill)),
                        child: const Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.local_offer_rounded, size: 13, color: Colors.white),
                          SizedBox(width: 4),
                          Text('Featured', style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 0.3)),
                        ]),
                      ),
                      const SizedBox(height: Space.sm),
                      Text(settings?.bannerTitle ?? HomeDefaults.bannerTitle, style: t.titleLarge?.copyWith(color: Colors.white, fontSize: 22, height: 1.2)),
                      const SizedBox(height: 4),
                      Text(settings?.bannerSubtitle ?? HomeDefaults.bannerSubtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.92), height: 1.4, fontSize: 13.5)),
                      const SizedBox(height: Space.lg),
                      FilledButton.icon(
                        onPressed: () => context.go(AppRoutes.services),
                        iconAlignment: IconAlignment.end,
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.greenDark, minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 18), shape: const StadiumBorder()),
                        label: Text(settings?.bannerButtonText ?? HomeDefaults.bannerButtonText),
                      ),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: Space.lg),
              // Trust strip
              Row(
                children: [
                  for (final (i, point) in HomeDefaults.trustPoints.indexed) ...[
                    if (i > 0) const SizedBox(width: Space.sm),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 10),
                        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(Radii.md), border: Border.all(color: AppColors.borderSoft)),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const Icon(Icons.verified_rounded, size: 15, color: AppColors.green),
                          const SizedBox(width: 4),
                          Flexible(child: Text(point, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.navy))),
                        ]),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: Space.xxl),
              SectionHeader('Categories', action: 'See all', onAction: () => context.go(AppRoutes.services)),
              cats.when(
                data: (list) => GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 0.78,
                  mainAxisSpacing: Space.sm,
                  crossAxisSpacing: Space.sm,
                  children: [for (final (i, c) in list.take(8).indexed) CategoryTile(category: c, index: i, onTap: () => context.push(AppRoutes.categoryPath(c.id), extra: c.name))],
                ),
                loading: () => const SizedBox(height: 180, child: Center(child: CircularProgressIndicator())),
                error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(categoriesProvider)),
              ),
              const SizedBox(height: Space.xl),
              // Upcoming booking
              ...home.maybeWhen(
                data: (h) => [
                  if (h.upcoming.isNotEmpty) ...[
                    SectionHeader('Upcoming booking', action: 'All bookings', onAction: () => context.go(AppRoutes.bookings)),
                    BookingCard(booking: h.upcoming.first as BookingSummary, onTap: () => context.push(AppRoutes.bookingPath((h.upcoming.first as BookingSummary).id))),
                    const SizedBox(height: Space.xl),
                  ],
                  if (h.reminders.isNotEmpty) ...[
                    const SectionHeader('Service reminders'),
                    ...h.reminders.map((r) => Padding(
                          padding: const EdgeInsets.only(bottom: Space.sm),
                          child: AppCard(
                            color: AppColors.amberSoft,
                            border: false,
                            child: Row(children: [
                              const Icon(Icons.alarm_rounded, color: AppColors.amber),
                              const SizedBox(width: Space.md),
                              Expanded(child: Text('${r.service} due ${Fmt.dateOnly(r.dueDate)}', style: t.titleSmall)),
                              TextButton(onPressed: () => startBooking(context, ref), child: const Text('Book')),
                            ]),
                          ),
                        )),
                    const SizedBox(height: Space.lg),
                  ],
                  if (h.outstanding > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Space.xl),
                      child: AppCard(
                        onTap: () => context.push(AppRoutes.invoices),
                        child: Row(children: [
                          const IconBox(Icons.account_balance_wallet_rounded, color: AppColors.red, background: AppColors.redSoft),
                          const SizedBox(width: Space.md),
                          Expanded(child: Text('Outstanding balance ${Fmt.money(h.outstanding)}', style: t.titleSmall)),
                          const Icon(Icons.chevron_right_rounded),
                        ]),
                      ),
                    ),
                ],
                orElse: () => const <Widget>[],
              ),
              SectionHeader('Popular services', action: 'View all', onAction: () => context.go(AppRoutes.services)),
              popular.when(
                data: (list) => Column(
                  children: list
                      .map((s) => Padding(
                            padding: const EdgeInsets.only(bottom: Space.sm),
                            child: ServiceCard(service: s, onTap: () => context.push(AppRoutes.servicePath(s.id)), onBook: () => startBooking(context, ref, service: s)),
                          ))
                      .toList(),
                ),
                loading: () => const LoadingView(rows: 2),
                error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(popularServicesProvider)),
              ),
              const SizedBox(height: Space.xl),
              // Book a repair
              AppCard(
                onTap: () => startBooking(context, ref, type: 'REPAIR'),
                gradient: AppColors.brandGradient,
                padding: const EdgeInsets.all(Space.xl),
                child: Row(children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: Colors.white.withValues(alpha: 0.25))),
                    child: const Icon(Icons.build_circle_rounded, color: Colors.white, size: 28),
                  ),
                  const SizedBox(width: Space.lg),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Something not working?', style: t.titleMedium?.copyWith(color: Colors.white)),
                      const SizedBox(height: 2),
                      Text('Describe the problem and we’ll send an expert.', style: t.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.82))),
                    ]),
                  ),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.arrow_forward_rounded, color: AppColors.blue, size: 20),
                  ),
                ]),
              ),
              const SizedBox(height: Space.md),
              AppCard(
                onTap: () => context.go(AppRoutes.amc),
                color: AppColors.greenSoft,
                border: false,
                child: Row(children: [
                  const IconBox(Icons.verified_user_rounded, color: Colors.white, gradient: AppColors.greenGradient, size: 52),
                  const SizedBox(width: Space.lg),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('AMC plans', style: t.titleMedium),
                      Text(home.value != null && home.value!.amcCount > 0 ? 'You have ${home.value!.amcCount} active plan(s)' : 'Year-round care with scheduled visits', style: t.bodyMedium),
                    ]),
                  ),
                  const Icon(Icons.arrow_forward_rounded, color: AppColors.greenDark),
                ]),
              ),
              const SizedBox(height: Space.md),
              AppCard(
                onTap: () => context.push(AppRoutes.support),
                child: Row(children: [
                  const IconBox(Icons.support_agent_rounded),
                  const SizedBox(width: Space.lg),
                  Expanded(child: Text('Need help? Talk to our support team', style: t.titleSmall)),
                  const Icon(Icons.chevron_right_rounded),
                ]),
              ),
              const SizedBox(height: Space.xxxl),
            ]),
          ),
        ]),
      ),
    );
  }
}
