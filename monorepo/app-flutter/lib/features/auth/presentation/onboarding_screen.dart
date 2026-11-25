/// First-run onboarding carousel.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../catalog/domain/catalog_entities.dart';
import '../../catalog/presentation/catalog_providers.dart';
import 'auth_provider.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  /// Illustration per welcome screen; the wording comes from Admin → Settings → Customer App.
  static const _icons = [Icons.ac_unit_rounded, Icons.event_available_rounded, Icons.verified_user_rounded];

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
    final pages = ref.watch(publicSettingsProvider).value?.onboarding ?? OnboardingPageConfig.defaults;
    final last = _page == pages.length - 1;
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
              itemCount: pages.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) {
                final p = pages[i];
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
                          child: Icon(_icons[i % _icons.length], size: 64, color: Colors.white),
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
              pages.length,
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
