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
import '../../auth/presentation/avatar_picker.dart';
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
      appBar: pageAppBar(context, title: 'Profile'),
      body: RefreshIndicator(
        onRefresh: () {
          ref.invalidate(avatarProvider);
          return ref.refresh(profileProvider.future);
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(Space.page, Space.xs, Space.page, Space.page), children: [
          profile.when(
            data: (p) => ProfileHeaderCard(
              initials: p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : '?',
              name: p.fullName,
              lines: ['${AppConstants.countryCode} ${p.mobile}', if (p.email != null && p.email!.isNotEmpty) p.email!],
              badge: p.code,
              onEdit: () => _editProfile(context, ref, p),
              avatarUrl: ref.watch(avatarProvider).value,
              onAvatarTap: () => changeAvatar(context, ref),
            ),
            loading: () => const SizedBox(height: 90, child: Center(child: CircularProgressIndicator())),
            error: (e, _) => ErrorView(message: friendlyError(e), onRetry: () => ref.invalidate(profileProvider)),
          ),
          const SizedBox(height: Space.xl),
          MenuGroup(title: 'Account', items: [
            MenuEntry(icon: Icons.location_on_outlined, label: 'Saved addresses', subtitle: 'Where our technicians visit', tint: (AppColors.greenDark, AppColors.greenSoft), onTap: () => context.push(AppRoutes.addresses)),
            MenuEntry(icon: Icons.notifications_none_rounded, label: 'Notifications', tint: (AppColors.violet, AppColors.violetSoft), onTap: () => context.push(AppRoutes.notifications)),
            MenuEntry(icon: Icons.alarm_rounded, label: 'Service reminders', subtitle: 'When your AC is due for service', tint: (AppColors.amber, AppColors.amberSoft), onTap: () => context.push(AppRoutes.reminders)),
          ]),
          const SizedBox(height: Space.xl),
          MenuGroup(title: 'Billing', items: [
            MenuEntry(icon: Icons.receipt_long_outlined, label: 'Invoices', onTap: () => context.push(AppRoutes.invoices)),
            MenuEntry(icon: Icons.account_balance_wallet_outlined, label: 'Payments', tint: (AppColors.cyan, AppColors.cyanSoft), onTap: () => context.push(AppRoutes.payments)),
          ]),
          const SizedBox(height: Space.xl),
          MenuGroup(title: 'Help', items: [
            MenuEntry(icon: Icons.support_agent_rounded, label: 'Help & support', subtitle: 'Call, WhatsApp or email us', tint: (AppColors.rose, AppColors.roseSoft), onTap: () => context.push(AppRoutes.support)),
            MenuEntry(
              icon: Icons.logout_rounded,
              label: 'Log out',
              destructive: true,
              onTap: () async {
                if (await confirmDialog(context, title: 'Log out?', message: 'You’ll need to sign in again.', confirm: 'Log out', destructive: true)) {
                  await ref.read(authControllerProvider.notifier).logout();
                }
              },
            ),
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
