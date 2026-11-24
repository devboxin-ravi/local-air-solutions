/// Design system: brand tokens (from the Local Air Solutions logo), spacing, radii,
/// typography and Material 3 component themes. UI code references these — never raw values.
library;

import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract class AppColors {
  static const Color blue = Color(0xFF0048A8); // logo wordmark
  static const Color blueDark = Color(0xFF003A8A);
  static const Color blueSoft = Color(0xFFEEF4FD);
  static const Color green = Color(0xFF88C040); // logo leaf
  static const Color greenDark = Color(0xFF5E8F27);
  static const Color greenSoft = Color(0xFFF2F8E8);
  static const Color navy = Color(0xFF0F1F3D);
  static const Color slate = Color(0xFF5B6B82);
  static const Color slateLight = Color(0xFF94A3B8);
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderSoft = Color(0xFFEDF1F7);
  static const Color background = Color(0xFFF3F6FB);
  static const Color inputFill = Color(0xFFF1F5FA);
  static const Color sky = Color(0xFF38BDF8);
  static const Color skySoft = Color(0xFFE0F2FE);
  static const Color rose = Color(0xFFE11D48);
  static const Color roseSoft = Color(0xFFFFE4E6);
  static const Color star = Color(0xFFF59E0B);
  static const Color surface = Colors.white;
  static const Color red = Color(0xFFDC2626);
  static const Color redSoft = Color(0xFFFEE2E2);
  static const Color amber = Color(0xFFD97706);
  static const Color amberSoft = Color(0xFFFEF3C7);
  static const Color violet = Color(0xFF7C3AED);
  static const Color violetSoft = Color(0xFFEDE9FE);
  static const Color cyan = Color(0xFF0891B2);
  static const Color cyanSoft = Color(0xFFCFFAFE);

  /// Deep "cool air" gradient for hero headers.
  static const LinearGradient brandGradient = LinearGradient(colors: [Color(0xFF04245C), blue, Color(0xFF1C79D8)], stops: [0, 0.55, 1], begin: Alignment.topLeft, end: Alignment.bottomRight);
  /// Primary call-to-action fill.
  static const LinearGradient ctaGradient = LinearGradient(colors: [blue, Color(0xFF1E6FD6)], begin: Alignment.centerLeft, end: Alignment.centerRight);
  static const LinearGradient greenGradient = LinearGradient(colors: [greenDark, green], begin: Alignment.topLeft, end: Alignment.bottomRight);
  static const LinearGradient skyGradient = LinearGradient(colors: [Color(0xFF0369A1), Color(0xFF0EA5E9)], begin: Alignment.topLeft, end: Alignment.bottomRight);
  static const LinearGradient freshGradient = LinearGradient(colors: [blueSoft, greenSoft], begin: Alignment.topLeft, end: Alignment.bottomRight);

  /// Foreground/background pairs that give each category or tile its own colour.
  static const List<(Color, Color)> tints = [(blue, blueSoft), (greenDark, greenSoft), (cyan, cyanSoft), (violet, violetSoft), (amber, amberSoft), (rose, roseSoft)];
  static (Color, Color) tintAt(int index) => tints[index % tints.length];
}

abstract class Space {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double page = 20;
}

abstract class Radii {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 28;
  static const double button = 14;
  static const double pill = 999;
}

abstract class Sizes {
  static const double buttonHeight = 54; // large touch target (outdoor friendly)
  static const double inputHeight = 52;
  static const double iconBox = 44;
}

abstract class Motion {
  static const Duration fast = Duration(milliseconds: 160);
  static const Duration medium = Duration(milliseconds: 240);
  static const Curve curve = Curves.easeOutCubic;
}

abstract class AppShadows {
  static const List<BoxShadow> card = [BoxShadow(color: Color(0x0F0F1F3D), blurRadius: 12, offset: Offset(0, 4))];
  static const List<BoxShadow> raised = [BoxShadow(color: Color(0x1A0F1F3D), blurRadius: 24, offset: Offset(0, 10))];
  /// Soft, layered elevation for white cards on the tinted background.
  static const List<BoxShadow> soft = [
    BoxShadow(color: Color(0x0D0F1F3D), blurRadius: 18, offset: Offset(0, 6)),
    BoxShadow(color: Color(0x080F1F3D), blurRadius: 3, offset: Offset(0, 1)),
  ];
  /// Upward shadow for the bottom navigation bar.
  static const List<BoxShadow> nav = [BoxShadow(color: Color(0x140F1F3D), blurRadius: 20, offset: Offset(0, -4))];
  /// Coloured glow under gradient buttons and hero tiles.
  static List<BoxShadow> glow(Color color) => [BoxShadow(color: color.withValues(alpha: 0.32), blurRadius: 18, offset: const Offset(0, 8))];
}

/// Status → (foreground, background) colours.
abstract class StatusColors {
  static (Color, Color) of(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'PAID':
      case 'VERIFIED':
      case 'ACTIVE':
        return (AppColors.greenDark, AppColors.greenSoft);
      case 'CANCELLED':
      case 'REJECTED':
      case 'FAILED':
      case 'OVERDUE':
        return (AppColors.red, AppColors.redSoft);
      case 'PENDING_PAYMENT':
      case 'PAYMENT_VERIFICATION':
      case 'PENDING_VERIFICATION':
      case 'PARTIALLY_PAID':
      case 'RESCHEDULED':
      case 'EXPIRING':
      case 'DUE':
      case 'UNPAID':
        return (AppColors.amber, AppColors.amberSoft);
      case 'ASSIGNED':
      case 'ACCEPTED':
        return (AppColors.violet, AppColors.violetSoft);
      case 'ON_THE_WAY':
      case 'ARRIVED':
      case 'IN_PROGRESS':
        return (AppColors.cyan, AppColors.cyanSoft);
      default:
        return (AppColors.blue, AppColors.blueSoft);
    }
  }
}

abstract class AppTheme {
  static TextTheme _text(TextTheme base) {
    final t = GoogleFonts.interTextTheme(base);
    final display = GoogleFonts.plusJakartaSansTextTheme(base);
    return t.copyWith(
      displaySmall: display.displaySmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.navy, letterSpacing: -0.5),
      headlineMedium: display.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: AppColors.navy, letterSpacing: -0.5),
      headlineSmall: display.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.navy, fontSize: 22),
      titleLarge: display.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: AppColors.navy, fontSize: 19),
      titleMedium: t.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.navy, fontSize: 16),
      titleSmall: t.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: AppColors.navy, fontSize: 14),
      bodyLarge: t.bodyLarge?.copyWith(color: AppColors.navy, fontSize: 15.5, height: 1.45),
      bodyMedium: t.bodyMedium?.copyWith(color: AppColors.slate, fontSize: 14, height: 1.45),
      bodySmall: t.bodySmall?.copyWith(color: AppColors.slate, fontSize: 12.5),
      labelLarge: t.labelLarge?.copyWith(fontWeight: FontWeight.w700, fontSize: 15.5),
    );
  }

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(seedColor: AppColors.blue, primary: AppColors.blue, secondary: AppColors.green, surface: AppColors.surface, error: AppColors.red);
    final base = ThemeData(useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: AppColors.background);
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.button), borderSide: const BorderSide(color: AppColors.borderSoft));
    return base.copyWith(
      textTheme: _text(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        foregroundColor: AppColors.navy,
        titleTextStyle: GoogleFonts.plusJakartaSans(fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.navy),
      ),
      cardTheme: CardThemeData(color: AppColors.surface, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg), side: const BorderSide(color: AppColors.borderSoft))),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.inputFill,
        contentPadding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: 16),
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(borderSide: const BorderSide(color: AppColors.blue, width: 1.6)),
        errorBorder: border.copyWith(borderSide: const BorderSide(color: AppColors.red)),
        focusedErrorBorder: border.copyWith(borderSide: const BorderSide(color: AppColors.red, width: 1.6)),
        labelStyle: const TextStyle(color: AppColors.slate),
        hintStyle: const TextStyle(color: AppColors.slateLight),
        prefixIconColor: WidgetStateColor.resolveWith((s) => s.contains(WidgetState.focused) ? AppColors.blue : AppColors.slateLight),
        floatingLabelStyle: WidgetStateTextStyle.resolveWith((s) => TextStyle(color: s.contains(WidgetState.error) ? AppColors.red : AppColors.blue, fontWeight: FontWeight.w600)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(Sizes.buttonHeight),
          backgroundColor: AppColors.blue,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.button)),
          textStyle: GoogleFonts.inter(fontSize: 15.5, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(Sizes.buttonHeight),
          foregroundColor: AppColors.blue,
          backgroundColor: AppColors.surface,
          side: const BorderSide(color: AppColors.border, width: 1.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.button)),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: AppColors.blue, textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700))),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.surface,
        selectedColor: AppColors.blueSoft,
        side: const BorderSide(color: AppColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill)),
        labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.navy),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.blueSoft,
        indicatorShape: const StadiumBorder(),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 70,
        labelTextStyle: WidgetStateProperty.resolveWith((s) => GoogleFonts.inter(fontSize: 12, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500, color: s.contains(WidgetState.selected) ? AppColors.blue : AppColors.slate)),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppColors.blue : AppColors.slate)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent, showDragHandle: true, shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)))),
      dialogTheme: DialogThemeData(backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.xl))),
      snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: AppColors.navy, elevation: 6, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.button))),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.blue, linearTrackColor: AppColors.blueSoft),
      floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: AppColors.blue, foregroundColor: Colors.white, elevation: 4, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg))),
      listTileTheme: const ListTileThemeData(iconColor: AppColors.blue, contentPadding: EdgeInsets.symmetric(horizontal: Space.lg)),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1, space: 1),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
    );
  }
}
