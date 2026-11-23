/// Auth domain entities. Pure Dart — no framework or network dependencies.
library;

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.mobile,
    required this.userType,
    required this.roles,
    this.email,
    this.customerId,
    this.staffId,
  });

  final int id;
  final String name;
  final String? email;
  final String mobile;
  final String userType;
  final List<String> roles;
  final int? customerId;
  final int? staffId;

  /// Role-based app experience: technicians get the field app, everyone else the customer app.
  bool get isTechnician => staffId != null && (userType == 'STAFF' || roles.contains('TECHNICIAN'));
  bool get isCustomer => userType == 'CUSTOMER' && customerId != null;
  String get firstName => name.trim().split(RegExp(r'\s+')).first;
}

enum AuthStatus { unknown, unauthenticated, otpRequired, authenticated }

class AuthState {
  const AuthState({required this.status, this.user, this.pendingUserId});
  final AuthStatus status;
  final AppUser? user;
  final int? pendingUserId;

  static const unknown = AuthState(status: AuthStatus.unknown);
  static const signedOut = AuthState(status: AuthStatus.unauthenticated);
}

/// Login result from the domain's perspective.
sealed class LoginOutcome {}

class LoginSucceeded extends LoginOutcome {
  LoginSucceeded(this.user);
  final AppUser user;
}

class LoginNeedsOtp extends LoginOutcome {
  LoginNeedsOtp(this.userId);
  final int userId;
}
