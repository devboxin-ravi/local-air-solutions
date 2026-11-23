/// Branded splash shown while the session is restored. Routing happens in the router redirect.
library;

import 'package:flutter/material.dart';

import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.92, end: 1),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutBack,
            builder: (_, v, child) => Opacity(opacity: ((v - 0.92) / 0.08).clamp(0, 1), child: Transform.scale(scale: v, child: child)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const BrandLogo(height: 96),
              const SizedBox(height: Space.xxxl),
              SizedBox(width: 120, child: LinearProgressIndicator(minHeight: 3, borderRadius: BorderRadius.circular(Radii.pill), color: AppColors.green, backgroundColor: AppColors.greenSoft)),
            ]),
          ),
        ),
      );
}
