/// Bottom-navigation shells for the customer and technician experiences.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/themes/app_theme.dart';

/// Floating, rounded navigation bar that sits above the page with a soft shadow.
class _ShellNavBar extends StatelessWidget {
  const _ShellNavBar({required this.shell, required this.destinations});
  final StatefulNavigationShell shell;
  final List<NavigationDestination> destinations;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: AppColors.background,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.md),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.surface,
              boxShadow: AppShadows.nav,
              borderRadius: BorderRadius.circular(Radii.xxl),
              border: Border.all(color: AppColors.borderSoft),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(Radii.xxl),
              child: MediaQuery.removePadding(
                context: context,
                removeBottom: true,
                child: NavigationBar(
                  selectedIndex: shell.currentIndex,
                  onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
                  destinations: destinations,
                ),
              ),
            ),
          ),
        ),
      );
}

class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: shell,
        bottomNavigationBar: _ShellNavBar(
          shell: shell,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view_rounded), label: 'Services'),
            NavigationDestination(icon: Icon(Icons.event_note_outlined), selectedIcon: Icon(Icons.event_note_rounded), label: 'Bookings'),
            NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield_rounded), label: 'AMC'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      );
}

class TechnicianShell extends StatelessWidget {
  const TechnicianShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: shell,
        bottomNavigationBar: _ShellNavBar(
          shell: shell,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Today'),
            NavigationDestination(icon: Icon(Icons.work_outline_rounded), selectedIcon: Icon(Icons.work_rounded), label: 'Jobs'),
            NavigationDestination(icon: Icon(Icons.history_rounded), label: 'History'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      );
}
