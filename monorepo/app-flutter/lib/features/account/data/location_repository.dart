/// Device location: GPS fix + reverse geocoding (Android/iOS native geocoder, no API key).
library;

import 'package:flutter/widgets.dart' show Locale;
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/constants/app_constants.dart';
import '../domain/account_entities.dart';

/// Thrown with a user-facing [message] when the location can't be read.
class LocationException implements Exception {
  const LocationException(this.message, {this.openSettings = false});
  final String message;

  /// True when the user must enable location / permission from system settings.
  final bool openSettings;
  @override
  String toString() => message;
}

class LocationRepository {
  final Geocoding _geocoding = Geocoding(locale: const Locale(LocationConfig.geocodeLanguage, LocationConfig.geocodeCountry));

  /// Asks for permission if needed, reads the current position and resolves it to an address.
  Future<DetectedLocation> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) throw const LocationException(Messages.locationServiceOff, openSettings: true);
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) throw const LocationException(Messages.locationDenied);
    if (permission == LocationPermission.deniedForever) throw const LocationException(Messages.locationDeniedForever, openSettings: true);

    final pos = await _preciseFix();

    List<Placemark> marks;
    try {
      marks = await _geocoding.placemarkFromCoordinates(pos.latitude, pos.longitude);
    } catch (_) {
      marks = const []; // Coordinates are still useful for directions even without an address.
    }
    return _toLocation(pos, marks);
  }

  /// Streams GPS fixes and keeps the most accurate one, stopping early once it reaches
  /// [LocationConfig.targetAccuracyMeters]. The first fix is often a coarse network/cell position.
  Future<Position> _preciseFix() async {
    Position? best;
    try {
      await for (final p in Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, distanceFilter: 0),
      ).timeout(LocationConfig.fixTimeout)) {
        if (best == null || p.accuracy < best.accuracy) best = p;
        if (p.accuracy <= LocationConfig.targetAccuracyMeters) break;
      }
    } catch (_) {
      // Timed out or stream error — fall through with the best fix seen so far.
    }
    if (best != null) return best;
    try {
      return await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: LocationConfig.fixTimeout));
    } catch (_) {
      throw const LocationException(Messages.locationFailed);
    }
  }

  /// Merges all placemarks the geocoder returns: the first is often only a plus code or locality,
  /// while later ones carry the street, house number and neighbourhood.
  DetectedLocation _toLocation(Position pos, List<Placemark> marks) {
    String? clean(String? s) {
      final t = s?.trim();
      if (t == null || t.isEmpty || LocationConfig.plusCodePattern.hasMatch(t)) return null;
      return t;
    }

    String? first(String? Function(Placemark) pick) {
      for (final m in marks) {
        final v = clean(pick(m));
        if (v != null) return v;
      }
      return null;
    }

    final city = first((m) => m.locality) ?? first((m) => m.subAdministrativeArea);
    final area = first((m) => m.subLocality);
    String? street;
    for (final m in marks) {
      final s = [clean(m.subThoroughfare), clean(m.thoroughfare)].whereType<String>().join(' ');
      if (s.isNotEmpty) {
        street = s;
        break;
      }
    }
    // A named place (building, shop, society) that isn't just the street / area / city repeated.
    final known = {street, area, city}.whereType<String>().map((s) => s.toLowerCase()).toSet();
    final place = first((m) => known.contains(m.name?.trim().toLowerCase()) ? null : m.name);

    return DetectedLocation(
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracyMeters: pos.accuracy,
      line1: street ?? place,
      line2: area,
      landmark: street != null ? place : null,
      city: city,
      state: first((m) => m.administrativeArea),
      pincode: first((m) => m.postalCode),
    );
  }

  /// Opens the system screen where location / app permission can be turned on.
  Future<void> openSettings({required bool serviceOff}) => serviceOff ? Geolocator.openLocationSettings() : Geolocator.openAppSettings();

  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();
}
