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

    final Position pos;
    try {
      pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: LocationConfig.fixTimeout));
    } catch (_) {
      throw const LocationException(Messages.locationFailed);
    }

    Placemark? p;
    try {
      final marks = await _geocoding.placemarkFromCoordinates(pos.latitude, pos.longitude);
      p = marks.isEmpty ? null : marks.first;
    } catch (_) {
      p = null; // Coordinates are still useful for directions even without an address.
    }
    String? clean(String? s) => (s == null || s.trim().isEmpty) ? null : s.trim();
    final street = [clean(p?.subThoroughfare), clean(p?.thoroughfare)].whereType<String>().join(' ');
    return DetectedLocation(
      latitude: pos.latitude,
      longitude: pos.longitude,
      line1: clean(street) ?? clean(p?.name),
      line2: clean(p?.subLocality),
      city: clean(p?.locality) ?? clean(p?.subAdministrativeArea),
      state: clean(p?.administrativeArea),
      pincode: clean(p?.postalCode),
    );
  }

  /// Opens the system screen where location / app permission can be turned on.
  Future<void> openSettings({required bool serviceOff}) => serviceOff ? Geolocator.openLocationSettings() : Geolocator.openAppSettings();

  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();
}
