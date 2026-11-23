/// Services tab: search + categories + full catalogue; category listing; service details.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../bookings/presentation/booking_providers.dart';
import '../domain/catalog_entities.dart';
import 'catalog_providers.dart';
import 'catalog_widgets.dart';

void startBooking(BuildContext context, WidgetRef ref, {ServiceItem? service, String type = 'SERVICE'}) {
  ref.read(bookingFlowProvider.notifier).start(type: type, service: service);
  context.push(type == 'REPAIR' ? AppRoutes.repairRequest : AppRoutes.bookService);
}

class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});
  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    final results = ref.watch(serviceSearchProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Services')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          final _ = await ref.refresh(allServicesProvider.future);
        },
        child: CustomScrollView(slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.lg),
            sliver: SliverToBoxAdapter(
              child: TextField(onChanged: (v) => setState(() => _q = v), decoration: const InputDecoration(hintText: 'Search AC repair, gas refill, geyser…', prefixIcon: Icon(Icons.search_rounded))),
            ),
          ),
          if (_q.isEmpty)
            SliverToBoxAdapter(
              child: cats.when(
                data: (list) => SizedBox(
                  height: 112,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: Space.page),
                    scrollDirection: Axis.horizontal,
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(width: Space.md),
                    itemBuilder: (_, i) => SizedBox(width: 80, child: CategoryTile(category: list[i], onTap: () => context.push(AppRoutes.categoryPath(list[i].id), extra: list[i].name))),
                  ),
                ),
                loading: () => const SizedBox(height: 112),
                error: (e, _) => const SizedBox.shrink(),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(Space.page, Space.md, Space.page, Space.sm),
            sliver: SliverToBoxAdapter(child: SectionHeader(_q.isEmpty ? 'All services' : 'Results for “$_q”')),
          ),
          results.when(
            data: (list) => list.isEmpty
                ? const SliverToBoxAdapter(child: EmptyView(title: 'No matching services', message: 'Try a different word, or request a repair.', icon: Icons.search_off_rounded))
                : SliverPadding(
                    padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.xxl),
                    sliver: SliverList.separated(
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                      itemBuilder: (_, i) => ServiceCard(service: list[i], onTap: () => context.push(AppRoutes.servicePath(list[i].id)), onBook: () => startBooking(context, ref, service: list[i])),
                    ),
                  ),
            loading: () => const SliverToBoxAdapter(child: LoadingView()),
            error: (e, _) => SliverToBoxAdapter(child: ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(allServicesProvider))),
          ),
        ]),
      ),
    );
  }
}

class CategoryServicesScreen extends ConsumerWidget {
  const CategoryServicesScreen({super.key, required this.categoryId, this.title});
  final int categoryId;
  final String? title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(categoryServicesProvider(categoryId));
    return Scaffold(
      appBar: AppBar(title: Text(title ?? 'Services')),
      body: AsyncBody<List<ServiceItem>>(
        value: value,
        onRetry: () => ref.invalidate(categoryServicesProvider(categoryId)),
        data: (list) => list.isEmpty
            ? const EmptyView(title: 'No services yet', message: 'Check back soon.')
            : ListView.separated(
                padding: const EdgeInsets.all(Space.page),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                itemBuilder: (_, i) => ServiceCard(service: list[i], onTap: () => context.push(AppRoutes.servicePath(list[i].id)), onBook: () => startBooking(context, ref, service: list[i])),
              ),
      ),
    );
  }
}

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});
  final int serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(serviceProvider(serviceId));
    final t = Theme.of(context).textTheme;
    return Scaffold(
      body: AsyncBody<ServiceItem>(
        value: value,
        onRetry: () => ref.invalidate(serviceProvider(serviceId)),
        data: (s) => CustomScrollView(slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 230,
            backgroundColor: AppColors.blue,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(gradient: AppColors.brandGradient),
                child: Stack(children: [
                  Positioned(right: -30, top: 20, child: Icon(iconForCategory(s.categoryName), size: 220, color: Colors.white.withValues(alpha: 0.08))),
                  Positioned(
                    left: Space.page,
                    right: Space.page,
                    bottom: Space.xl,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(Radii.pill)),
                        child: Text(s.categoryName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                      ),
                      const SizedBox(height: Space.sm),
                      Text(s.name, style: t.headlineSmall?.copyWith(color: Colors.white)),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(Space.page),
            sliver: SliverList.list(children: [
              Row(children: [
                _Fact(icon: Icons.schedule_rounded, label: '${s.durationMinutes} min'),
                const SizedBox(width: Space.sm),
                _Fact(icon: Icons.receipt_long_outlined, label: s.gstApplicable ? 'GST ${s.gstRate.toStringAsFixed(0)}%' : 'GST exempt'),
                const SizedBox(width: Space.sm),
                const _Fact(icon: Icons.verified_outlined, label: 'Trained techs'),
              ]),
              const SizedBox(height: Space.xl),
              AppCard(
                color: AppColors.blueSoft,
                border: false,
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.isQuotation ? 'Pricing' : s.isStarting ? 'Starting at' : 'Price', style: t.bodySmall),
                      Text(priceText(s), style: t.headlineSmall?.copyWith(color: AppColors.blue)),
                    ]),
                  ),
                  Text(s.isQuotation ? 'Final price after\ninspection' : '+ GST as applicable', textAlign: TextAlign.right, style: t.bodySmall),
                ]),
              ),
              const SizedBox(height: Space.xl),
              Text('About this service', style: t.titleMedium),
              const SizedBox(height: Space.sm),
              Text(s.description ?? 'Professional ${s.name.toLowerCase()} by trained Local Air Solutions technicians.', style: t.bodyLarge?.copyWith(color: AppColors.slate)),
              const SizedBox(height: Space.xl),
              Text('What you get', style: t.titleMedium),
              const SizedBox(height: Space.sm),
              ...['Verified, uniformed technician', 'Transparent pricing & GST invoice', 'Service history & reminders in the app', 'Support on call and WhatsApp'].map(
                (x) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 20), const SizedBox(width: Space.sm), Expanded(child: Text(x, style: t.bodyLarge))])),
              ),
              const SizedBox(height: 100),
            ]),
          ),
        ]),
      ),
      bottomNavigationBar: value.maybeWhen(
        data: (s) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.page, Space.sm, Space.page, Space.md),
            child: PrimaryButton(label: 'Book now · ${priceText(s)}', icon: Icons.event_available_rounded, onPressed: () => startBooking(context, ref, service: s)),
          ),
        ),
        orElse: () => null,
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: Space.md, horizontal: Space.sm),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.md), border: Border.all(color: AppColors.border)),
          child: Column(children: [Icon(icon, color: AppColors.green, size: 20), const SizedBox(height: 4), Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.navy))]),
        ),
      );
}

