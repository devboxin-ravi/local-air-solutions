/// External intents: phone call, WhatsApp, Google Maps directions.
library;

import 'package:url_launcher/url_launcher.dart';

abstract class Launcher {
  static Future<bool> call(String phone) => launchUrl(Uri(scheme: 'tel', path: phone.replaceAll(' ', '')));

  /// Correctly encoded wa.me link (digits only, with country code).
  static Future<bool> whatsapp(String phone, String message) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final full = digits.length == 10 ? '91$digits' : digits;
    return launchUrl(Uri.parse('https://wa.me/$full?text=${Uri.encodeComponent(message)}'), mode: LaunchMode.externalApplication);
  }

  /// Uses verified coordinates when available, otherwise an address search — never invented coordinates.
  static Future<bool> directions({double? lat, double? lng, required String address}) {
    final uri = (lat != null && lng != null)
        ? Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving')
        : Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  static Future<bool> openUrl(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
}
