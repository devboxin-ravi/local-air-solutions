/// API endpoint paths (relative to AppConfig.apiBaseUrl) and timeouts.
library;

abstract class ApiConstants {
  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String otpVerify = '/auth/otp/verify';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String meAvatar = '/auth/me/avatar';
  static const String avatarField = 'file';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String changePassword = '/auth/change-password';
  static const String devices = '/auth/devices';

  // Public catalogue & master data
  static const String publicSettings = '/settings/public';
  static const String categories = '/categories';
  static const String services = '/services';
  static String service(int id) => '/services/$id';
  static const String states = '/states';
  static const String cities = '/cities';
  static const String products = '/products';
  static const String availableSlots = '/slots/available';

  // Customer (/me)
  static const String meHome = '/me/home';
  static const String meProfile = '/me/profile';
  static const String meAddresses = '/me/addresses';
  static String meAddress(int id) => '/me/addresses/$id';
  static const String meBookings = '/me/bookings';
  static String meBooking(int id) => '/me/bookings/$id';
  static String meBookingCancel(int id) => '/me/bookings/$id/cancel';
  static String meBookingAttachments(int id) => '/me/bookings/$id/attachments';
  static const String meInvoices = '/me/invoices';
  static String meInvoice(int id) => '/me/invoices/$id';
  static const String mePayments = '/me/payments';
  static const String meUpiPayment = '/me/payments/upi';
  static const String meAmc = '/me/amc';
  static String meAmcOne(int id) => '/me/amc/$id';
  static const String meReminders = '/me/reminders';
  static const String meLedger = '/me/ledger';

  // Notifications
  static const String notifications = '/notifications';
  static const String notificationsRead = '/notifications/read';

  // Technician
  static const String techDashboard = '/technician/dashboard';
  static const String techJobs = '/technician/jobs';
  static String techJob(int id) => '/technician/jobs/$id';
  static String techRespond(int id) => '/technician/jobs/$id/respond';
  static String techStatus(int id) => '/technician/jobs/$id/status';
  static String techComplete(int id) => '/technician/jobs/$id/complete';
  static String techNotes(int id) => '/technician/jobs/$id/notes';
  static String techPhotos(int id) => '/technician/jobs/$id/photos';

  // Headers
  static const String idempotencyHeader = 'Idempotency-Key';

  // Timeouts (ms)
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 30000;
  static const int sendTimeout = 60000;
}
