/// Pure formatting & validation helpers (no Flutter UI, no I/O).
library;

import 'package:intl/intl.dart';

import '../constants/app_constants.dart';

abstract class Fmt {
  static final _money = NumberFormat.currency(locale: AppConstants.locale, symbol: AppConstants.currencySymbol, decimalDigits: 2);
  static final _moneyShort = NumberFormat.currency(locale: AppConstants.locale, symbol: AppConstants.currencySymbol, decimalDigits: 0);
  static final _date = DateFormat('dd MMM yyyy');
  static final _dateShort = DateFormat('EEE, dd MMM');
  static final _dateTime = DateFormat('dd MMM, hh:mm a');
  static final _ymd = DateFormat('yyyy-MM-dd');

  static double toNum(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse("$v") ?? 0);
  static String money(dynamic v) => _money.format(toNum(v));
  static String moneyShort(dynamic v) => _moneyShort.format(toNum(v));
  static DateTime? parse(dynamic v) => v == null ? null : DateTime.tryParse('$v')?.toLocal();
  static String date(dynamic v) => parse(v) == null ? '—' : _date.format(parse(v)!);
  static String dateShort(dynamic v) => parse(v) == null ? '—' : _dateShort.format(parse(v)!);
  static String dateTime(dynamic v) => parse(v) == null ? '—' : _dateTime.format(parse(v)!);
  static String ymd(DateTime d) => _ymd.format(d);

  /// Date-only values from the API are UTC midnight — format without timezone shift.
  static String dateOnly(dynamic v) {
    final d = DateTime.tryParse('$v');
    return d == null ? '—' : _date.format(DateTime(d.year, d.month, d.day));
  }

  /// Pieces of a date-only value for calendar-style tiles: "23", "NOV", "Mon".
  static String dayOfMonth(dynamic v) => _datePart(v, DateFormat('dd'));
  static String monthAbbr(dynamic v) => _datePart(v, DateFormat('MMM')).toUpperCase();
  static String weekdayAbbr(dynamic v) => _datePart(v, DateFormat('EEE'));
  static String _datePart(dynamic v, DateFormat f) {
    final d = DateTime.tryParse('$v');
    return d == null ? '—' : f.format(DateTime(d.year, d.month, d.day));
  }

  static String dateOnlyShort(dynamic v) {
    final d = DateTime.tryParse('$v');
    return d == null ? '—' : _dateShort.format(DateTime(d.year, d.month, d.day));
  }

  static String humanize(String? s) => s == null || s.isEmpty
      ? ''
      : s.toLowerCase().split('_').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');

  static String relative(dynamic v) {
    final d = parse(v);
    if (d == null) return '—';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return date(v);
  }
}

abstract class Validators {
  static final _mobile = RegExp(r'^[6-9]\d{9}$');
  static final _pincode = RegExp(r'^[1-9]\d{5}$');
  static final _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _password = RegExp(r'^(?=.*[A-Za-z])(?=.*\d).+$');

  static String? required(String? v) => (v == null || v.trim().isEmpty) ? Messages.required : null;

  static String? name(String? v) {
    final t = v?.trim() ?? '';
    if (t.length < Limits.nameMin) return 'Enter at least ${Limits.nameMin} characters';
    if (t.length > Limits.nameMax) return 'Maximum ${Limits.nameMax} characters';
    return null;
  }

  static String? mobile(String? v) => _mobile.hasMatch(v?.trim() ?? '') ? null : Messages.mobile;
  static String? optionalEmail(String? v) => (v == null || v.trim().isEmpty) ? null : (_email.hasMatch(v.trim()) && v.trim().length <= Limits.emailMax ? null : Messages.email);
  static String? pincode(String? v) => _pincode.hasMatch(v?.trim() ?? '') ? null : Messages.pincode;
  static String? password(String? v) => (v != null && v.length >= Limits.passwordMin && _password.hasMatch(v)) ? null : Messages.password;
  static String? identifier(String? v) => (v == null || v.trim().length < 3) ? 'Enter your mobile or email' : null;

  static String? Function(String?) length(int min, int max, {String label = 'This field'}) => (v) {
        final t = v?.trim() ?? '';
        if (t.length < min) return min <= 1 ? Messages.required : '$label needs at least $min characters';
        if (t.length > max) return 'Maximum $max characters';
        return null;
      };
}
