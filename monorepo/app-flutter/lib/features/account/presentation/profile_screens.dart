/// Profile tab, address management and support screens.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/launcher.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../auth/presentation/auth_provider.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../domain/account_entities.dart';
import 'account_providers.dart';
import 'address_form_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(profileProvider.future),
        child: ListView(padding: const EdgeInsets.all(Space.page), children: [
          profile.when(
            data: (p) => AppCard(
              onTap: () => _editProfile(context, ref, p),
              child: Row(children: [
                CircleAvatar(radius: 28, backgroundColor: AppColors.blue, child: Text(p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800))),
                const SizedBox(width: Space.lg),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.fullName, style: t.titleMedium),
                    Text('${AppConstants.countryCode} ${p.mobile}', style: t.bodyMedium),
                    Text(p.code, style: t.bodySmall),
                  ]),
                ),
                const Icon(Icons.edit_outlined, color: AppColors.slate),
              ]),
            ),
            loading: () => const SizedBox(height: 90, child: Center(child: CircularProgressIndicator())),
            error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(profileProvider)),
          ),
          const SizedBox(height: Space.xl),
          _Group(items: [
            _Item(Icons.location_on_outlined, 'Saved addresses', () => context.push(AppRoutes.addresses)),
            _Item(Icons.receipt_long_outlined, 'Invoices', () => context.push(AppRoutes.invoices)),
            _Item(Icons.account_balance_wallet_outlined, 'Payments', () => context.push(AppRoutes.payments)),
            _Item(Icons.alarm_rounded, 'Service reminders', () => context.push(AppRoutes.reminders)),
            _Item(Icons.notifications_none_rounded, 'Notifications', () => context.push(AppRoutes.notifications)),
          ]),
          const SizedBox(height: Space.lg),
          _Group(items: [
            _Item(Icons.support_agent_rounded, 'Help & support', () => context.push(AppRoutes.support)),
            _Item(Icons.logout_rounded, 'Log out', () async {
              if (await confirmDialog(context, title: 'Log out?', message: 'You’ll need to sign in again.', confirm: 'Log out', destructive: true)) {
                await ref.read(authControllerProvider.notifier).logout();
              }
            }, color: AppColors.red),
          ]),
          const SizedBox(height: Space.xl),
          Center(child: Text('${AppConfig.appName} v${AppConfig.appVersion}', style: t.bodySmall)),
        ]),
      ),
    );
  }

  Future<void> _editProfile(BuildContext context, WidgetRef ref, CustomerProfile p) async {
    final name = TextEditingController(text: p.fullName);
    final email = TextEditingController(text: p.email ?? '');
    final key = GlobalKey<FormState>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (c) => Padding(
        padding: EdgeInsets.fromLTRB(Space.page, 0, Space.page, MediaQuery.viewInsetsOf(c).bottom + Space.page),
        child: Form(
          key: key,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Edit profile', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: Space.lg),
            TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Full name'), validator: (v) => (v == null || v.trim().length < 2) ? 'Enter your name' : null),
            const SizedBox(height: Space.md),
            TextFormField(controller: email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: Space.lg),
            PrimaryButton(
              label: 'Save',
              onPressed: () async {
                if (!key.currentState!.validate()) return;
                try {
                  await ref.read(accountRepositoryProvider).updateProfile(fullName: name.text, email: email.text);
                  ref.invalidate(profileProvider);
                  if (c.mounted) Navigator.pop(c);
                } on ApiException catch (e) {
                  if (c.mounted) showAppSnack(c, e.message, error: true);
                }
              },
            ),
          ]),
        ),
      ),
    );
  }
}

class _Item {
  const _Item(this.icon, this.label, this.onTap, {this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
}

class _Group extends StatelessWidget {
  const _Group({required this.items});
  final List<_Item> items;
  @override
  Widget build(BuildContext context) => AppCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              ListTile(
                leading: Icon(items[i].icon, color: items[i].color ?? AppColors.blue),
                title: Text(items[i].label, style: TextStyle(fontWeight: FontWeight.w600, color: items[i].color ?? AppColors.navy)),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slateLight),
                onTap: items[i].onTap,
                minTileHeight: 56,
              ),
              if (i < items.length - 1) const Divider(indent: 56),
            ],
          ],
        ),
      );
}

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Saved addresses')),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => showAddressSheet(context, ref), backgroundColor: AppColors.blue, foregroundColor: Colors.white, icon: const Icon(Icons.add), label: const Text('Add address')),
      body: AsyncBody<List<Address>>(
        value: value,
        onRetry: () => ref.invalidate(addressesProvider),
        data: (list) => list.isEmpty
            ? const EmptyView(title: 'No saved addresses', message: 'Add where you’d like our technicians to visit.', icon: Icons.location_off_outlined)
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(Space.page, Space.page, Space.page, 100),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: Space.sm),
                itemBuilder: (_, i) {
                  final a = list[i];
                  return AppCard(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const IconBox(Icons.location_on_rounded, color: AppColors.greenDark, background: AppColors.greenSoft, size: 40),
                      const SizedBox(width: Space.md),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [Text(a.label, style: Theme.of(context).textTheme.titleSmall), if (a.isDefault) const Padding(padding: EdgeInsets.only(left: 6), child: StatusBadge('DEFAULT'))]),
                          const SizedBox(height: 2),
                          Text(a.full, style: Theme.of(context).textTheme.bodyMedium),
                        ]),
                      ),
                      PopupMenuButton<String>(
                        onSelected: (v) async {
                          if (v == 'edit') {
                            await showAddressSheet(context, ref, existing: a);
                          } else if (await confirmDialog(context, title: 'Remove address?', message: a.full, confirm: 'Remove', destructive: true)) {
                            try {
                              await ref.read(accountRepositoryProvider).deleteAddress(a.id);
                              ref.invalidate(addressesProvider);
                            } on ApiException catch (e) {
                              if (context.mounted) showAppSnack(context, e.message, error: true);
                            }
                          }
                        },
                        itemBuilder: (_) => const [PopupMenuItem(value: 'edit', child: Text('Edit')), PopupMenuItem(value: 'delete', child: Text('Remove'))],
                      ),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(publicSettingsProvider).value;
    final phone = s?.supportPhone ?? AppConfig.supportPhone;
    final wa = s?.supportWhatsapp ?? AppConfig.supportWhatsapp;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Help & support')),
      body: ListView(padding: const EdgeInsets.all(Space.page), children: [
        Container(
          padding: const EdgeInsets.all(Space.xl),
          decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(Radii.xl)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.support_agent_rounded, color: Colors.white, size: 40),
            const SizedBox(height: Space.md),
            Text('We’re here to help', style: t.titleLarge?.copyWith(color: Colors.white)),
            const SizedBox(height: 4),
            Text('Questions about a booking, invoice or AMC? Reach our team directly.', style: t.bodyMedium?.copyWith(color: Colors.white70)),
          ]),
        ),
        const SizedBox(height: Space.xl),
        if (phone.isNotEmpty) AppCard(onTap: () => Launcher.call(phone), child: Row(children: [const IconBox(Icons.call_rounded), const SizedBox(width: Space.md), Expanded(child: Text('Call $phone', style: t.titleSmall)), const Icon(Icons.chevron_right)])),
        const SizedBox(height: Space.sm),
        if (wa.isNotEmpty)
          AppCard(
            onTap: () => Launcher.whatsapp(wa, 'Hello Local Air Solutions, I need help with my service.'),
            child: Row(children: [const IconBox(Icons.chat_rounded, color: AppColors.greenDark, background: AppColors.greenSoft), const SizedBox(width: Space.md), Expanded(child: Text('Chat on WhatsApp', style: t.titleSmall)), const Icon(Icons.chevron_right)]),
          ),
        if (phone.isEmpty && wa.isEmpty) const EmptyView(title: 'Support contacts not configured', message: 'Please try again later.', icon: Icons.contact_support_outlined),
      ]),
    );
  }
}
