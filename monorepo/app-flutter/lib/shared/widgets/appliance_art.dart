/// Vector illustrations of home appliances (split / window / outdoor AC unit, washer, fridge,
/// geyser), drawn in code so they stay crisp at any size and need no image assets. UI only.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

enum ApplianceKind { splitAc, windowAc, outdoorUnit, washer, fridge, geyser }

class ApplianceArt extends StatelessWidget {
  const ApplianceArt(this.kind, {super.key, this.width = 120, this.height = 90, this.airflow = false});
  final ApplianceKind kind;
  final double width;
  final double height;

  /// Draws cool-air streams under a split AC (hero headers).
  final bool airflow;

  @override
  Widget build(BuildContext context) => RepaintBoundary(child: CustomPaint(size: Size(width, height), painter: _AppliancePainter(kind, airflow)));
}

class _AppliancePainter extends CustomPainter {
  const _AppliancePainter(this.kind, this.airflow);
  final ApplianceKind kind;
  final bool airflow;

  static const _bodyTop = Color(0xFFFFFFFF);
  static const _bodyBottom = Color(0xFFE3E9F2);
  static const _line = Color(0xFFB8C4D6);
  static const _dark = Color(0xFF334155);
  static const _darker = Color(0xFF1E293B);
  static const _accent = Color(0xFF3B82F6);

  @override
  void paint(Canvas canvas, Size size) {
    switch (kind) {
      case ApplianceKind.splitAc:
        _split(canvas, size);
      case ApplianceKind.windowAc:
        _window(canvas, size);
      case ApplianceKind.outdoorUnit:
        _outdoor(canvas, size);
      case ApplianceKind.washer:
        _washer(canvas, size);
      case ApplianceKind.fridge:
        _fridge(canvas, size);
      case ApplianceKind.geyser:
        _geyser(canvas, size);
    }
  }

  // ── helpers ──
  void _body(Canvas c, RRect r, {List<Color> colors = const [_bodyTop, _bodyBottom]}) {
    c.drawShadow(Path()..addRRect(r.shift(const Offset(0, 2))), const Color(0xFF0F1F3D), 6, false);
    c.drawRRect(r, Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: colors).createShader(r.outerRect));
    c.drawRRect(
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = const Color(0xFFCBD5E1));
  }

  Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..color = color;

  // ── split indoor unit ──
  void _split(Canvas c, Size s) {
    final h = airflow ? s.height * 0.55 : s.height * 0.5;
    final top = airflow ? s.height * 0.04 : s.height * 0.25;
    final body = RRect.fromLTRBR(s.width * 0.03, top, s.width * 0.97, top + h, Radius.circular(h * 0.22));
    _body(c, body);
    // top highlight
    c.drawLine(Offset(body.left + h * 0.3, top + h * 0.12), Offset(body.right - h * 0.3, top + h * 0.12), _stroke(Colors.white, 1.4));
    // air outlet slot with louvre
    final slot = RRect.fromLTRBR(body.left + s.width * 0.07, top + h * 0.66, body.right - s.width * 0.07, top + h * 0.84, Radius.circular(h * 0.08));
    c.drawRRect(slot, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_darker, _dark]).createShader(slot.outerRect));
    c.drawLine(Offset(slot.left + 4, slot.center.dy), Offset(slot.right - 4, slot.center.dy), _stroke(const Color(0xFF64748B), 1));
    // status LED + display
    c.drawCircle(Offset(body.right - s.width * 0.1, top + h * 0.38), h * 0.055, Paint()..color = _accent);
    c.drawRRect(RRect.fromLTRBR(body.left + s.width * 0.08, top + h * 0.33, body.left + s.width * 0.2, top + h * 0.43, const Radius.circular(2)), Paint()..color = const Color(0xFFE2E8F0));
    if (airflow) {
      final p = _stroke(const Color(0xFF93C5FD).withValues(alpha: 0.75), 2.2);
      for (var i = 0; i < 4; i++) {
        final x = slot.left + (slot.width / 4) * (i + 0.5);
        final path = Path()..moveTo(x, slot.bottom + 4);
        path.cubicTo(x - 10, slot.bottom + s.height * 0.12, x + 10, slot.bottom + s.height * 0.22, x - 6, s.height * 0.97);
        c.drawPath(path, p);
      }
    }
  }

  // ── window unit ──
  void _window(Canvas c, Size s) {
    final side = math.min(s.width * 0.86, s.height * 1.2);
    final w = side;
    final h = side * 0.72;
    final left = (s.width - w) / 2;
    final top = (s.height - h) / 2;
    final body = RRect.fromLTRBR(left, top, left + w, top + h, Radius.circular(h * 0.1));
    _body(c, body);
    // front grille
    final grille = Rect.fromLTRB(left + w * 0.07, top + h * 0.12, left + w * 0.66, top + h * 0.88);
    c.drawRRect(RRect.fromRectAndRadius(grille, const Radius.circular(3)), Paint()..color = const Color(0xFFF1F5F9));
    final line = _stroke(_line, 1.4);
    for (var y = grille.top + 5; y < grille.bottom - 2; y += h * 0.075) {
      c.drawLine(Offset(grille.left + 4, y), Offset(grille.right - 4, y), line);
    }
    // side vents + control panel
    final panel = Rect.fromLTRB(left + w * 0.71, top + h * 0.12, left + w * 0.93, top + h * 0.88);
    c.drawRRect(RRect.fromRectAndRadius(panel, const Radius.circular(3)), Paint()..color = const Color(0xFFE2E8F0));
    final vent = _stroke(_dark.withValues(alpha: 0.7), 1.6);
    for (var x = panel.left + 4; x < panel.right - 2; x += w * 0.035) {
      c.drawLine(Offset(x, panel.top + 4), Offset(x, panel.top + panel.height * 0.55), vent);
    }
    c.drawRRect(RRect.fromLTRBR(panel.left + 4, panel.bottom - panel.height * 0.3, panel.right - 4, panel.bottom - 5, const Radius.circular(2)), Paint()..color = const Color(0xFF0EA5E9));
  }

  // ── outdoor condenser ──
  void _outdoor(Canvas c, Size s) {
    final w = math.min(s.width * 0.9, s.height * 1.25);
    final h = w * 0.72;
    final left = (s.width - w) / 2;
    final top = (s.height - h) / 2 - h * 0.04;
    // feet
    final foot = Paint()..color = const Color(0xFF94A3B8);
    c.drawRect(Rect.fromLTWH(left + w * 0.1, top + h, w * 0.12, h * 0.07), foot);
    c.drawRect(Rect.fromLTWH(left + w * 0.78, top + h, w * 0.12, h * 0.07), foot);
    final body = RRect.fromLTRBR(left, top, left + w, top + h, Radius.circular(h * 0.06));
    _body(c, body);
    // fan
    final center = Offset(left + w * 0.38, top + h * 0.5);
    final r = h * 0.38;
    c.drawCircle(center, r, Paint()..color = const Color(0xFFE2E8F0));
    c.drawCircle(center, r, _stroke(const Color(0xFF94A3B8), 1.6));
    for (var k = 1; k <= 4; k++) {
      c.drawCircle(center, r * k / 5, _stroke(_line, 1));
    }
    final blade = Paint()..color = const Color(0xFF64748B);
    for (var i = 0; i < 4; i++) {
      final a = i * math.pi / 2 + 0.5;
      final path = Path()
        ..moveTo(center.dx, center.dy)
        ..quadraticBezierTo(center.dx + math.cos(a - 0.5) * r * 0.9, center.dy + math.sin(a - 0.5) * r * 0.9, center.dx + math.cos(a) * r * 0.82, center.dy + math.sin(a) * r * 0.82)
        ..quadraticBezierTo(center.dx + math.cos(a + 0.35) * r * 0.4, center.dy + math.sin(a + 0.35) * r * 0.4, center.dx, center.dy);
      c.drawPath(path, blade);
    }
    c.drawCircle(center, r * 0.14, Paint()..color = _darker);
    // side grille + valve cover
    final panel = Rect.fromLTRB(left + w * 0.8, top + h * 0.1, left + w * 0.94, top + h * 0.9);
    final vent = _stroke(_line, 1.3);
    for (var y = panel.top; y < panel.bottom; y += h * 0.07) {
      c.drawLine(Offset(panel.left, y), Offset(panel.right, y), vent);
    }
  }

  // ── front-load washer ──
  void _washer(Canvas c, Size s) {
    final h = s.height * 0.9;
    final w = h * 0.82;
    final left = (s.width - w) / 2;
    final top = (s.height - h) / 2;
    _body(c, RRect.fromLTRBR(left, top, left + w, top + h, Radius.circular(w * 0.08)));
    c.drawLine(Offset(left + 2, top + h * 0.2), Offset(left + w - 2, top + h * 0.2), _stroke(_line, 1.2));
    c.drawCircle(Offset(left + w * 0.8, top + h * 0.1), h * 0.045, Paint()..color = _dark);
    c.drawRRect(RRect.fromLTRBR(left + w * 0.12, top + h * 0.07, left + w * 0.42, top + h * 0.13, const Radius.circular(2)), Paint()..color = const Color(0xFF0EA5E9));
    final center = Offset(left + w / 2, top + h * 0.6);
    final r = w * 0.32;
    c.drawCircle(center, r, Paint()..color = const Color(0xFF94A3B8));
    c.drawCircle(center, r * 0.8, Paint()..shader = const RadialGradient(colors: [Color(0xFFBFDBFE), Color(0xFF60A5FA)]).createShader(Rect.fromCircle(center: center, radius: r * 0.8)));
    c.drawArc(Rect.fromCircle(center: center, radius: r * 0.55), 3.6, 1.2, false, _stroke(Colors.white.withValues(alpha: 0.8), 2));
  }

  // ── fridge ──
  void _fridge(Canvas c, Size s) {
    final h = s.height * 0.94;
    final w = h * 0.52;
    final left = (s.width - w) / 2;
    final top = (s.height - h) / 2;
    _body(c, RRect.fromLTRBR(left, top, left + w, top + h, Radius.circular(w * 0.12)));
    c.drawLine(Offset(left + 2, top + h * 0.36), Offset(left + w - 2, top + h * 0.36), _stroke(_line, 1.4));
    final handle = Paint()..color = const Color(0xFF94A3B8);
    c.drawRRect(RRect.fromLTRBR(left + w * 0.78, top + h * 0.12, left + w * 0.86, top + h * 0.28, const Radius.circular(3)), handle);
    c.drawRRect(RRect.fromLTRBR(left + w * 0.78, top + h * 0.44, left + w * 0.86, top + h * 0.64, const Radius.circular(3)), handle);
  }

  // ── water heater ──
  void _geyser(Canvas c, Size s) {
    final h = s.height * 0.84;
    final w = h * 0.5;
    final left = (s.width - w) / 2;
    final top = s.height * 0.04;
    _body(c, RRect.fromLTRBR(left, top, left + w, top + h, Radius.circular(w * 0.45)));
    final pipe = _stroke(const Color(0xFF94A3B8), 3);
    c.drawLine(Offset(left + w * 0.32, top + h), Offset(left + w * 0.32, s.height * 0.98), pipe);
    c.drawLine(Offset(left + w * 0.68, top + h), Offset(left + w * 0.68, s.height * 0.98), pipe);
    final dial = Offset(left + w / 2, top + h * 0.55);
    c.drawCircle(dial, w * 0.2, Paint()..color = const Color(0xFFE2E8F0));
    c.drawCircle(dial, w * 0.2, _stroke(_line, 1.3));
    c.drawLine(dial, dial + Offset(w * 0.09, -w * 0.1), _stroke(const Color(0xFFEF4444), 2));
    c.drawCircle(Offset(left + w / 2, top + h * 0.28), w * 0.05, Paint()..color = const Color(0xFFF97316));
  }

  @override
  bool shouldRepaint(_AppliancePainter old) => old.kind != kind || old.airflow != airflow;
}

/// Showcase split AC: shaded body with a side panel for depth, louvres, display,
/// and soft cool-air ribbons flowing down-left. For promo banners.
class SplitAcShowcase extends StatelessWidget {
  const SplitAcShowcase({super.key, this.width = 220, this.height = 150});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => RepaintBoundary(child: CustomPaint(size: Size(width, height), painter: const _SplitAcShowcasePainter()));
}

class _SplitAcShowcasePainter extends CustomPainter {
  const _SplitAcShowcasePainter();

  @override
  void paint(Canvas c, Size s) {
    final w = s.width;
    final h = s.height;
    final bodyH = h * 0.44;
    final top = h * 0.04;
    final left = w * 0.08;
    final right = w * 0.98;
    final radius = Radius.circular(bodyH * 0.2);

    // Soft drop shadow
    final body = RRect.fromLTRBR(left, top, right, top + bodyH, radius);
    c.drawShadow(Path()..addRRect(body.shift(const Offset(-4, 6))), const Color(0xFF0F1F3D), 14, false);

    // Main body: white → cool grey
    c.drawRRect(
        body,
        Paint()
          ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFFFFF), Color(0xFFF1F4F8), Color(0xFFDDE3EA)], stops: [0, 0.6, 1])
              .createShader(body.outerRect));

    // Right end cap (depth)
    final capW = w * 0.07;
    final cap = RRect.fromLTRBAndCorners(right - capW, top, right, top + bodyH, topRight: radius, bottomRight: radius);
    c.drawRRect(cap, Paint()..shader = const LinearGradient(colors: [Color(0xFFE6EBF1), Color(0xFFC9D2DD)]).createShader(cap.outerRect));
    c.drawLine(
        Offset(right - capW, top + 4),
        Offset(right - capW, top + bodyH - 4),
        Paint()
          ..color = const Color(0xFFCBD5E1)
          ..strokeWidth = 1);

    // Glossy top highlight
    c.drawLine(
        Offset(left + bodyH * 0.35, top + bodyH * 0.1),
        Offset(right - capW - 10, top + bodyH * 0.1),
        Paint()
          ..color = Colors.white
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round);

    // Front panel seam
    c.drawLine(
        Offset(left + 6, top + bodyH * 0.58),
        Offset(right - capW - 4, top + bodyH * 0.58),
        Paint()
          ..color = const Color(0xFFD5DCE5)
          ..strokeWidth = 1);

    // Air outlet with louvres
    final slot = RRect.fromLTRBR(left + w * 0.05, top + bodyH * 0.68, right - capW - w * 0.03, top + bodyH * 0.9, Radius.circular(bodyH * 0.06));
    c.drawRRect(slot, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0F172A), Color(0xFF334155)]).createShader(slot.outerRect));
    final slat = Paint()
      ..color = const Color(0xFF94A3B8).withValues(alpha: 0.55)
      ..strokeWidth = 1;
    for (var x = slot.left + 8; x < slot.right - 6; x += 7) {
      c.drawLine(Offset(x, slot.top + 2), Offset(x - 2, slot.bottom - 2), slat);
    }
    // Louvre flap
    c.drawLine(
        Offset(slot.left + 4, slot.bottom),
        Offset(slot.right - 4, slot.bottom),
        Paint()
          ..color = const Color(0xFFE2E8F0)
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round);

    // Display + status LED
    c.drawRRect(RRect.fromLTRBR(right - capW - w * 0.16, top + bodyH * 0.3, right - capW - w * 0.07, top + bodyH * 0.42, const Radius.circular(2)), Paint()..color = const Color(0xFFE2E8F0));
    c.drawCircle(Offset(right - capW - w * 0.045, top + bodyH * 0.36), bodyH * 0.035, Paint()..color = const Color(0xFF22C55E));

    // Cool-air ribbons flowing down-left
    for (var i = 0; i < 5; i++) {
      final startX = slot.left + slot.width * (0.12 + i * 0.19);
      final startY = slot.bottom + 3;
      final endX = startX - w * 0.42;
      final endY = h * (0.88 + i * 0.025);
      final path = Path()
        ..moveTo(startX, startY)
        ..cubicTo(startX - w * 0.05, startY + h * 0.18, endX + w * 0.2, endY - h * 0.2, endX, endY);
      final rect = Rect.fromPoints(Offset(endX, startY), Offset(startX, endY));
      c.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = 9 - i * 0.8
          ..shader = LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [Colors.white.withValues(alpha: 0.95), const Color(0xFFBFE3FF).withValues(alpha: 0.55), Colors.white.withValues(alpha: 0)]).createShader(rect),
      );
    }
  }

  @override
  bool shouldRepaint(_SplitAcShowcasePainter old) => false;
}
