// Regression: chip labels (product picker, problem category, time slots) rendered invisible
// because the theme used a WidgetStateTextStyle, which ChoiceChip never resolves.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:app_flutter/shared/themes/app_theme.dart';

Color? _labelColor(WidgetTester tester, String label) {
  final paragraph = tester.renderObject<RenderParagraph>(find.text(label));
  Color? color;
  paragraph.text.visitChildren((span) {
    color ??= span.style?.color;
    return color == null;
  });
  return color;
}

void main() {
  testWidgets('ChoiceChip labels are visible in both selected states', (tester) async {
    GoogleFonts.config.allowRuntimeFetching = false;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: Wrap(children: [
          ChoiceChip(label: const Text('Unselected'), selected: false, onSelected: (_) {}),
          ChoiceChip(label: const Text('Selected'), selected: true, onSelected: (_) {}),
        ]),
      ),
    ));

    expect(_labelColor(tester, 'Unselected'), AppColors.navy);
    expect(_labelColor(tester, 'Selected'), Colors.white);
  });
}
