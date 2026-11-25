/// Services tab: search + categories + full catalogue; category listing; service details.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../../shared/widgets/appliance_art.dart';
import '../../account/presentation/account_providers.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../bookings/presentation/booking_providers.dart';
import '../domain/catalog_entities.dart';
import '../domain/catalog_rules.dart';
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

/// How many category tiles show before "More".
const int _visibleCategories = 5;

/// Popular services shown before "View All".
const int _popularPreview = 3;

const Map<ServiceSort, String> _sortLabels = {
  ServiceSort.recommended: 'Recommended',
  ServiceSort.priceLowToHigh: 'Price: low to high',
  ServiceSort.priceHighToLow: 'Price: high to low',
  ServiceSort.shortestFirst: 'Duration: shortest first',
};

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  final _search = TextEditingController();
  String _q = '';
  int? _categoryId;
  ServiceSort _sort = ServiceSort.recommended;
  bool _allPopular = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    final view = ref.watch(serviceViewProvider((query: _q, categoryId: _categoryId, sort: _sort)));
    final favorites = ref.watch(favoritesProvider);
    final browsing = _q.trim().isEmpty && _categoryId == null;

    Widget card(ServiceItem s) => ServiceCard(
          service: s,
          onTap: () => context.push(AppRoutes.servicePath(s.id)),
          onBook: () => startBooking(context, ref, service: s),
          favorite: favorites.contains(s.id),
          onFavorite: () => ref.read(favoritesProvider.notifier).toggle(s.id),
        );

    return Scaffold(
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(categoriesProvider);
            final _ = await ref.refresh(allServicesProvider.future);
          },
          child: CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: _ServicesHero(
                search: _search,
                onSearch: (v) => setState(() => _q = v),
                sortActive: _sort != ServiceSort.recommended,
                onFilter: _openSort,
              ),
            ),
            // Category filter row
            SliverToBoxAdapter(
              child: SizedBox(
                height: 128,
                child: cats.when(
                  data: (list) {
                    final shown = list.take(_visibleCategories).toList();
                    final more = list.length > _visibleCategories;
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(Space.page, Space.lg, Space.page, Space.xs),
                      scrollDirection: Axis.horizontal,
                      children: [
                        CategoryFilterTile(label: 'All Services', icon: Icons.grid_view_rounded, selected: _categoryId == null, onTap: () => setState(() => _categoryId = null)),
                        for (final c in shown) ...[
                          const SizedBox(width: Space.sm + 2),
                          CategoryFilterTile(label: c.name, icon: iconForCategory(c.name), selected: _categoryId == c.id, onTap: () => setState(() => _categoryId = c.id)),
                        ],
                        if (more) ...[
                          const SizedBox(width: Space.sm + 2),
                          CategoryFilterTile(label: 'More', icon: Icons.more_horiz_rounded, selected: _categoryId != null && !shown.any((c) => c.id == _categoryId), onTap: () => _openCategories(list)),
                        ],
                      ],
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (e, _) => const SizedBox.shrink(),
                ),
              ),
            ),
            ...view.when(
              data: (list) {
                if (list.isEmpty) {
                  return [
                    const SliverToBoxAdapter(child: EmptyView(title: 'No matching services', message: 'Try a different word or category, or request a repair.', icon: Icons.search_off_rounded)),
                  ];
                }
                if (!browsing) {
                  final cat = cats.value?.where((c) => c.id == _categoryId).firstOrNull;
                  return [
                    _sectionHeader(icon: Icons.tune_rounded, iconColor: AppColors.blue, title: _q.trim().isNotEmpty ? 'Results for “${_q.trim()}”' : (cat?.name ?? 'Services'), trailing: '${list.length} ${list.length == 1 ? 'service' : 'services'}'),
                    _cards(list, card),
                  ];
                }
                final popular = list.where((x) => x.isPopular).toList();
                final rest = list.where((x) => !x.isPopular).toList();
                final popularShown = _allPopular ? popular : popular.take(_popularPreview).toList();
                return [
                  if (popular.isNotEmpty) ...[
                    _sectionHeader(
                      icon: Icons.workspace_premium_rounded,
                      iconColor: AppColors.star,
                      title: 'Popular Services',
                      action: popular.length > _popularPreview ? (_allPopular ? 'Show less' : 'View All') : null,
                      onAction: () => setState(() => _allPopular = !_allPopular),
                    ),
                    _cards(popularShown, card),
                  ],
                  if (rest.isNotEmpty) ...[
                    _sectionHeader(icon: Icons.grid_view_rounded, iconColor: AppColors.blue, title: popular.isEmpty ? 'All Services' : 'More Services', trailing: '${rest.length}'),
                    _cards(rest, card),
                  ],
                  const SliverToBoxAdapter(child: SizedBox(height: Space.xxl)),
                ];
              },
              loading: () => [const SliverToBoxAdapter(child: LoadingView())],
              error: (e, _) => [SliverToBoxAdapter(child: ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(allServicesProvider)))],
            ),
          ]),
        ),
      ),
    );
  }

  Widget _sectionHeader({required IconData icon, required Color iconColor, required String title, String? trailing, String? action, VoidCallback? onAction}) => SliverPadding(
        padding: const EdgeInsets.fromLTRB(Space.page, Space.lg, Space.page, Space.md),
        sliver: SliverToBoxAdapter(
          child: Row(children: [
            Icon(icon, color: iconColor, size: 26),
            const SizedBox(width: Space.sm),
            Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 20))),
            if (trailing != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.track, borderRadius: BorderRadius.circular(Radii.pill)),
                child: Text(trailing, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.slate)),
              ),
            if (action != null)
              TextButton(
                onPressed: onAction,
                child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action), const SizedBox(width: 4), Icon(_allPopular ? Icons.expand_less_rounded : Icons.arrow_forward_rounded, size: 18)]),
              ),
          ]),
        ),
      );

  Widget _cards(List<ServiceItem> list, Widget Function(ServiceItem) card) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: Space.page),
        sliver: SliverList.separated(itemCount: list.length, separatorBuilder: (_, __) => const SizedBox(height: Space.md + 2), itemBuilder: (_, i) => card(list[i])),
      );

  Future<void> _openSort() async {
    final picked = await showModalBottomSheet<ServiceSort>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.sm), child: Text('Sort services', style: Theme.of(c).textTheme.titleLarge)),
          for (final entry in _sortLabels.entries)
            ListTile(
              title: Text(entry.value, style: TextStyle(fontWeight: entry.key == _sort ? FontWeight.w800 : FontWeight.w600, color: AppColors.navy)),
              trailing: entry.key == _sort ? const Icon(Icons.check_circle_rounded, color: AppColors.blue) : const Icon(Icons.circle_outlined, color: AppColors.border),
              onTap: () => Navigator.pop(c, entry.key),
            ),
          const SizedBox(height: Space.md),
        ]),
      ),
    );
    if (picked != null) setState(() => _sort = picked);
  }

  Future<void> _openCategories(List<Category> list) async {
    final picked = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.lg),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('All categories', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: Space.lg),
            Wrap(spacing: Space.sm + 2, runSpacing: Space.sm + 2, children: [
              for (final cat in list) CategoryFilterTile(label: cat.name, icon: iconForCategory(cat.name), selected: cat.id == _categoryId, onTap: () => Navigator.pop(c, cat.id)),
            ]),
          ]),
        ),
      ),
    );
    if (picked != null) setState(() => _categoryId = picked);
  }
}

/// Gradient hero: location + notifications, title with an AC illustration, and a search bar
/// with a sort button overlapping the bottom edge.
class _ServicesHero extends ConsumerWidget {
  const _ServicesHero({required this.search, required this.onSearch, required this.sortActive, required this.onFilter});
  final TextEditingController search;
  final ValueChanged<String> onSearch;
  final bool sortActive;
  final VoidCallback onFilter;

  static const double _overlap = 30;
  static const double _searchHeight = 58;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider).value ?? const [];
    final address = addresses.where((a) => a.isDefault).firstOrNull ?? addresses.firstOrNull;
    final place = address == null ? 'Set your location' : [address.cityName, address.stateName].whereType<String>().where((x) => x.isNotEmpty).join(', ');
    final unread = ref.watch(unreadCountProvider);
    final top = MediaQuery.paddingOf(context).top;

    final hero = ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(Radii.xxl + 6)),
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.brandGradient),
        child: Stack(children: [
          const DecorBubbles(opacity: 0.07),
          const Positioned(right: Space.md, bottom: _overlap + 10, child: ApplianceArt(ApplianceKind.splitAc, width: 156, height: 118, airflow: true)),
          Padding(
            padding: EdgeInsets.fromLTRB(Space.page, top + Space.md, Space.page, _overlap + Space.xxl),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Material(
                  color: Colors.white.withValues(alpha: 0.12),
                  shape: StadiumBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.18))),
                  child: InkWell(
                    customBorder: const StadiumBorder(),
                    onTap: () => context.push(AppRoutes.addresses),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 7, 8, 7),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.location_on_rounded, color: Colors.white, size: 18),
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 200),
                          child: Text(place, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                        const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white, size: 20),
                      ]),
                    ),
                  ),
                ),
                const Spacer(),
                GlassIconButton(icon: Icons.notifications_none_rounded, tooltip: 'Notifications', badge: unread, onPressed: () => context.push(AppRoutes.notifications)),
              ]),
              const SizedBox(height: Space.xl),
              const Text('Services', style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.8, height: 1.1)),
              const SizedBox(height: 6),
              SizedBox(
                width: MediaQuery.sizeOf(context).width * 0.52,
                child: Text('Trusted experts for AC and home appliances', style: TextStyle(color: Colors.white.withValues(alpha: 0.88), fontSize: 15, height: 1.35)),
              ),
            ]),
          ),
        ]),
      ),
    );

    return Stack(children: [
      Padding(padding: const EdgeInsets.only(bottom: _overlap), child: hero),
      Positioned(
        left: Space.page,
        right: Space.page,
        bottom: 0,
        height: _searchHeight,
        child: Row(children: [
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(Radii.lg), boxShadow: AppShadows.raised),
              child: TextField(
                controller: search,
                onChanged: onSearch,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search services (e.g. AC repair, installation…)',
                  prefixIcon: const Icon(Icons.search_rounded, size: 24),
                  suffixIcon: search.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close_rounded, size: 20),
                          onPressed: () {
                            search.clear();
                            onSearch('');
                          },
                        ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.lg), borderSide: BorderSide.none),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.lg), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.lg), borderSide: const BorderSide(color: AppColors.blue, width: 1.6)),
                ),
              ),
            ),
          ),
          const SizedBox(width: Space.sm + 2),
          Badge(
            isLabelVisible: sortActive,
            smallSize: 10,
            backgroundColor: AppColors.green,
            child: Material(
              color: const Color(0xFFEAF1FD),
              borderRadius: BorderRadius.circular(Radii.lg),
              elevation: 3,
              shadowColor: const Color(0x330F1F3D),
              child: InkWell(
                onTap: onFilter,
                borderRadius: BorderRadius.circular(Radii.lg),
                child: const SizedBox(width: _searchHeight, height: _searchHeight, child: Icon(Icons.tune_rounded, color: AppColors.blue, size: 26)),
              ),
            ),
          ),
        ]),
      ),
    ]);
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
                separatorBuilder: (_, __) => const SizedBox(height: Space.md),
                itemBuilder: (_, i) => ServiceCard(
                  service: list[i],
                  onTap: () => context.push(AppRoutes.servicePath(list[i].id)),
                  onBook: () => startBooking(context, ref, service: list[i]),
                  favorite: ref.watch(favoritesProvider).contains(list[i].id),
                  onFavorite: () => ref.read(favoritesProvider.notifier).toggle(list[i].id),
                ),
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
            expandedHeight: 320,
            backgroundColor: AppColors.blueDark,
            foregroundColor: Colors.white,
            systemOverlayStyle: SystemUiOverlayStyle.light,
            leading: Padding(
              padding: const EdgeInsets.all(6),
              child: IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: Colors.black.withValues(alpha: 0.35), foregroundColor: Colors.white),
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded),
                tooltip: 'Back',
              ),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: Space.sm),
                child: IconButton.filled(
                  style: IconButton.styleFrom(backgroundColor: Colors.black.withValues(alpha: 0.35), foregroundColor: ref.watch(favoritesProvider).contains(s.id) ? const Color(0xFFFF6B81) : Colors.white),
                  onPressed: () => ref.read(favoritesProvider.notifier).toggle(s.id),
                  icon: Icon(ref.watch(favoritesProvider).contains(s.id) ? Icons.favorite_rounded : Icons.favorite_border_rounded),
                  tooltip: 'Favourite',
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(fit: StackFit.expand, children: [
                ServicePhotoView(
                  service: s,
                  fallback: DecoratedBox(
                    decoration: const BoxDecoration(gradient: AppColors.brandGradient),
                    child: Center(child: applianceFor(s) == null ? Icon(iconForCategory(s.categoryName), size: 120, color: Colors.white24) : ApplianceArt(applianceFor(s)!, width: 220, height: 160)),
                  ),
                ),
                // Darken the bottom so the title stays readable on any photo.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, stops: [0, 0.35, 1], colors: [Color(0x66000000), Color(0x00000000), Color(0xE6061A3D)]),
                  ),
                ),
                Positioned(
                  left: Space.page,
                  right: Space.page,
                  bottom: Space.xl,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(Radii.pill), border: Border.all(color: Colors.white.withValues(alpha: 0.3))),
                        child: Text(s.categoryName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                      ),
                      if (s.isPopular)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFFFB923C), Color(0xFFF97316)]), borderRadius: BorderRadius.circular(Radii.pill)),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.local_fire_department_rounded, size: 13, color: Colors.white),
                            SizedBox(width: 3),
                            Text('Popular', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                          ]),
                        ),
                    ]),
                    const SizedBox(height: Space.sm),
                    Text(s.name, style: t.headlineSmall?.copyWith(color: Colors.white, fontSize: 26, shadows: const [Shadow(color: Color(0x66000000), blurRadius: 8)])),
                  ]),
                ),
              ]),
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

