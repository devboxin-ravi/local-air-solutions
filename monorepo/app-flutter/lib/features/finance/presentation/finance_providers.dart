/// Invoices, payments, AMC and reminders providers.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/finance_repository.dart';
import '../domain/finance_entities.dart';
import '../../auth/presentation/auth_provider.dart';

final financeRepositoryProvider = Provider<FinanceRepository>((_) => FinanceRepository());
final invoicesProvider = FutureProvider<List<Invoice>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).invoices();
});
final invoiceProvider = FutureProvider.family<Invoice, int>((ref, id) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).invoice(id);
});
final paymentsProvider = FutureProvider<List<PaymentRecord>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).payments();
});
final amcListProvider = FutureProvider<List<AmcContract>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).amcContracts();
});
final amcProvider = FutureProvider.family<AmcContract, int>((ref, id) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).amc(id);
});
final remindersProvider = FutureProvider<List<Reminder>>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(financeRepositoryProvider).reminders();
});
