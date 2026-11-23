/// First-run onboarding carousel.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import 'auth_provider.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  static const _pages = [
    (icon: Icons.ac_unit_rounded, title: 'Expert AC care at home', text: 'Installation, servicing, gas refilling and repairs by trained technicians.'),
    (icon: Icons.event_available_rounded, title: 'Book in under a minute', text: 'Pick a service, choose a slot and track your technician live.'),
    (icon: Icons.verified_user_rounded, title: 'Transparent & protected', text: 'Clear pricing, GST invoices, AMC plans and timely service reminders.'),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await ref.read(authRepositoryProvider).setOnboardingDone();
    ref.invalidate(onboardingDoneProvider);
    if (mounted) context.go(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    final last = _page == _pages.length - 1;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.page, Space.lg, Space.sm, 0),
            child: Row(children: [const BrandLogo(height: 40), const Spacer(), TextButton(onPressed: _finish, child: const Text('Skip'))]),
          ),
          Expanded(
            child: PageView.builder(
              controller: _controller,
              itemCount: _pages.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) {
                final p = _pages[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.xxxl),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 220,
                      height: 220,
                      decoration: const BoxDecoration(gradient: AppColors.freshGradient, shape: BoxShape.circle),
                      child: Center(
                        child: Container(
                          width: 130,
                          height: 130,
                          decoration: const BoxDecoration(gradient: AppColors.brandGradient, shape: BoxShape.circle, boxShadow: AppShadows.raised),
                          child: Icon(p.icon, size: 64, color: Colors.white),
                        ),
                      ),
                    ),
                    const SizedBox(height: Space.xxxl + 8),
                    Text(p.title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: Space.md),
                    Text(p.text, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.slate)),
                  ]),
                );
              },
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              _pages.length,
              (i) => AnimatedContainer(
                duration: Motion.medium,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: i == _page ? 26 : 8,
                height: 8,
                decoration: BoxDecoration(color: i == _page ? AppColors.blue : AppColors.border, borderRadius: BorderRadius.circular(Radii.pill)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(Space.page),
            child: PrimaryButton(
              label: last ? 'Get started' : 'Next',
              icon: last ? Icons.arrow_forward_rounded : null,
              onPressed: () => last ? _finish() : _controller.nextPage(duration: Motion.medium, curve: Motion.curve),
            ),
          ),
        ]),
      ),
    );
  }
}
