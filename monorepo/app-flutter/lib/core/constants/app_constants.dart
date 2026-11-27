/// Application-wide constants: env keys, routes, storage keys, limits, statuses.
library;

abstract class AppConstants {
  // Environment variable keys
  static const String envApiBaseUrl = 'API_BASE_URL';
  static const String envAssetBaseUrl = 'ASSET_BASE_URL';
  static const String envAppEnv = 'APP_ENV';
  static const String envAppName = 'APP_NAME';
  static const String envAppVersion = 'APP_VERSION';
  static const String envSupportPhone = 'SUPPORT_PHONE';
  static const String envSupportWhatsapp = 'SUPPORT_WHATSAPP';
  static const String envFileName = '.env';

  // Storage keys
  static const String storageRefreshToken = 'las_refresh_token';
  static const String storageOnboardingDone = 'las_onboarding_done';
  static const String hiveBoxCache = 'las_cache';
  static const String cacheTechJobsPrefix = 'tech_jobs_';
  static const String cacheFavoriteServices = 'favorite_services';
  static const String cacheTechDashboard = 'tech_dashboard';

  // Roles / user types
  static const String userTypeCustomer = 'CUSTOMER';
  static const String userTypeStaff = 'STAFF';

  // Assets
  static const String logoAsset = 'assets/images/logo.png';
  static const String logoMarkAsset = 'assets/images/logo-mark.png';
  /// Featured promo banner artwork (split AC with cool air, leaves and plant).
  static const String bannerFeaturedAsset = 'assets/images/banner_featured_ac.png';

  // Locale & currency
  static const String locale = 'en_IN';
  static const String currencySymbol = '₹';
  static const String countryCode = '+91';
}

abstract class AppRoutes {
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String otp = '/otp';

  // Customer
  static const String home = '/home';
  static const String services = '/services';
  static const String categoryServices = '/services/category/:id';
  static const String serviceDetail = '/services/:id';
  static const String bookService = '/book';
  static const String repairRequest = '/repair';
  static const String bookings = '/bookings';
  static const String bookingDetail = '/bookings/:id';
  static const String payment = '/payment';
  static const String bookingSuccess = '/booking-success';
  static const String amc = '/amc';
  static const String amcDetail = '/amc/:id';
  static const String profile = '/profile';
  static const String addresses = '/profile/addresses';
  static const String invoices = '/profile/invoices';
  static const String invoiceDetail = '/profile/invoices/:id';
  static const String payments = '/profile/payments';
  static const String reminders = '/profile/reminders';
  static const String support = '/profile/support';
  static const String notifications = '/notifications';

  // Technician
  static const String techDashboard = '/tech';
  static const String techJobs = '/tech/jobs';
  static const String techJobDetail = '/tech/jobs/:id';
  static const String techHistory = '/tech/history';
  static const String techProfile = '/tech/profile';
  static const String techNotifications = '/tech/notifications';

  static String categoryPath(int id) => '/services/category/$id';
  static String servicePath(int id) => '/services/$id';
  static String bookingPath(int id) => '/bookings/$id';
  static String amcPath(int id) => '/amc/$id';
  static String invoicePath(int id) => '/profile/invoices/$id';
  static String techJobPath(int id) => '/tech/jobs/$id';
}

abstract class Limits {
  static const int nameMin = 2;
  static const int nameMax = 100;
  static const int emailMax = 254;
  static const int addressMin = 5;
  static const int addressMax = 500;
  static const int descriptionMax = 2000;
  static const int notesMax = 1000;
  static const int passwordMin = 8;
  static const int otpLength = 6;
  static const int maxPhotos = 6;
  static const int imageQuality = 70;
  static const double imageMaxWidth = 1600;
  /// Profile pictures are small: square-ish, resized on the phone before upload.
  static const double avatarMaxWidth = 640;
  static const int avatarQuality = 80;
  static const int pageSize = 20;
}

/// Booking statuses (mirrors backend enum).
abstract class BookingStatus {
  static const String pendingPayment = 'PENDING_PAYMENT';
  static const String paymentVerification = 'PAYMENT_VERIFICATION';
  static const String confirmed = 'CONFIRMED';
  static const String assigned = 'ASSIGNED';
  static const String accepted = 'ACCEPTED';
  static const String onTheWay = 'ON_THE_WAY';
  static const String arrived = 'ARRIVED';
  static const String inProgress = 'IN_PROGRESS';
  static const String completed = 'COMPLETED';
  static const String cancelled = 'CANCELLED';
  static const String rejected = 'REJECTED';
  static const String rescheduled = 'RESCHEDULED';

  /// Customer-facing tracking steps.
  static const List<String> trackingSteps = [confirmed, assigned, onTheWay, arrived, inProgress, completed];
  static const List<String> active = [assigned, accepted, onTheWay, arrived, inProgress];
  static const List<String> upcoming = [pendingPayment, paymentVerification, confirmed, assigned, accepted, onTheWay, arrived, inProgress, rescheduled];
  static const List<String> customerCancellable = [pendingPayment, paymentVerification, confirmed, assigned, accepted, rescheduled];
}

/// Fallback home-screen content; the live values come from Admin → Settings → Customer App Home.
abstract class HomeDefaults {
  static const String bannerButtonText = 'Book Now';

  /// Short reassurance points shown under the home banner (from the app's onboarding promises).
  static const List<String> trustPoints = ['Trained technicians', 'Clear pricing', 'GST invoices'];
}

abstract class Messages {
  static const String networkError = 'Can’t reach the server. Check your internet connection.';
  static const String genericError = 'Something went wrong. Please try again.';
  static const String paymentCancelled = 'Payment cancelled — you can try again any time.';
  static const String paymentFailed = 'Payment failed. Please try again.';
  static const String paymentExternalWallet = 'Finish the payment in your wallet app — it will be confirmed automatically.';
  static const String paymentSuccess = 'Payment successful — thank you!';
  static const String sessionExpired = 'Your session expired. Please sign in again.';
  static const String required = 'This field is required';
  static const String mobile = 'Enter a valid 10-digit mobile number';
  static const String email = 'Enter a valid email';
  static const String pincode = 'Enter a valid 6-digit PIN code';
  static const String password = 'Min 8 characters with a letter and a number';
  static const String offlineData = 'Showing saved data — you’re offline';
  static const String loadingList = 'Loading…';
  static const String listLoadFailed = 'Couldn’t load the list.';
  static const String tryAgain = 'Try again';
  static const String noCitiesForState = 'We don’t serve this state yet';
  static const String locationServiceOff = 'Turn on location (GPS) to use your current location.';
  static const String locationDenied = 'Location permission is needed to fill your address.';
  static const String locationDeniedForever = 'Location permission is blocked. Allow it in app settings.';
  static const String locationFailed = 'Couldn’t get your location. Please try again or type the address.';
  static const String locationFilled = 'Address filled from your location — please check the house / flat number.';
  static const String locationOutsideArea = 'We couldn’t match your state / city — please select it.';
}

/// Current-location lookup for the address form.
abstract class LocationConfig {
  static const Duration fixTimeout = Duration(seconds: 20);

  /// Stop refining the GPS fix once it is at least this accurate (metres).
  static const double targetAccuracyMeters = 20;

  /// Plus codes (e.g. "7MJ8+XQ") returned by the geocoder are not useful as a street line.
  static final RegExp plusCodePattern = RegExp(r'^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]*$', caseSensitive: false);
  static const String geocodeLanguage = 'en';
  static const String geocodeCountry = 'IN';
  static const String useCurrentLabel = 'Use my current location';
  static const String detectingLabel = 'Detecting location…';
  static const String settingsAction = 'Settings';
}

/// Bundled service photos (Pexels License, see assets/IMAGE_CREDITS.md). A photo uploaded
/// for a service in the admin panel always takes priority over these defaults.
abstract class ServiceImages {
  static const String splitAc = 'assets/images/service_split_ac.jpg';
  static const String windowAc = 'assets/images/service_window_ac.jpg';
  static const String outdoorUnit = 'assets/images/service_outdoor_unit.jpg';
  static const String acRepair = 'assets/images/service_ac_repair.jpg';
  static const String washerGeyser = 'assets/images/service_washer_geyser.jpg';
  static const String fridge = 'assets/images/service_fridge.jpg';
  static const String electrical = 'assets/images/service_electrical.jpg';
  static const String commercial = 'assets/images/service_commercial.jpg';
}
