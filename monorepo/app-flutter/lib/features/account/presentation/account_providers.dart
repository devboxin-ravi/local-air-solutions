/// Customer account providers (profile, addresses, home summary).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/account_repository.dart';
import '../data/location_repository.dart';
import '../domain/account_entities.dart';
import '../../auth/presentation/auth_provider.dart';

final accountRepositoryProvider = Provider<AccountRepository>((_) => AccountRepository());
final profileProvider = FutureProvider<CustomerProfile>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(accountRepositoryProvider).profile();
});
final addressesProvider = FutureProvider<List<Address>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(accountRepositoryProvider).addresses();
});
final addressBranchesProvider = FutureProvider<List<({int addressId, int? branchId})>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(accountRepositoryProvider).addressBranches();
});
final locationRepositoryProvider = Provider<LocationRepository>((_) => LocationRepository());
final homeSummaryProvider = FutureProvider<HomeSummary>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(accountRepositoryProvider).home();
});
