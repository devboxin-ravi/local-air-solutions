/// Customer account providers (profile, addresses, home summary).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/account_repository.dart';
import '../domain/account_entities.dart';

final accountRepositoryProvider = Provider<AccountRepository>((_) => AccountRepository());
final profileProvider = FutureProvider<CustomerProfile>((ref) => ref.read(accountRepositoryProvider).profile());
final addressesProvider = FutureProvider<List<Address>>((ref) => ref.read(accountRepositoryProvider).addresses());
final addressBranchesProvider = FutureProvider<List<({int addressId, int? branchId})>>((ref) => ref.read(accountRepositoryProvider).addressBranches());
final homeSummaryProvider = FutureProvider<HomeSummary>((ref) => ref.read(accountRepositoryProvider).home());
