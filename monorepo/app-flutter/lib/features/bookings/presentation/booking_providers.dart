/// Booking providers and the multi-step booking flow controller.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../account/presentation/account_providers.dart';
import '../../catalog/domain/catalog_entities.dart';
import '../data/booking_repository.dart';
import '../domain/booking_entities.dart';
import '../../auth/presentation/auth_provider.dart';

final bookingRepositoryProvider = Provider<BookingRepository>((_) => BookingRepository());

/// 'upcoming' or 'past'.
final myBookingsProvider = FutureProvider.family<List<BookingSummary>, String>((ref, tab) async {
  ref.watch(sessionUserIdProvider);
  final status = tab == 'upcoming' ? BookingStatus.upcoming.join(',') : [BookingStatus.completed, BookingStatus.cancelled, BookingStatus.rejected].join(',');
  return (await ref.read(bookingRepositoryProvider).myBookings(status: status)).items;
});

final bookingDetailProvider = FutureProvider.family<BookingDetail, int>((ref, id) {
  ref.watch(sessionUserIdProvider);
  return ref.read(bookingRepositoryProvider).detail(id);
});

class BookingFlowState {
  const BookingFlowState({required this.draft, this.step = 0, this.submitting = false, this.error, this.created});
  final BookingDraft draft;
  final int step;
  final bool submitting;
  final String? error;
  final BookingSummary? created;

  BookingFlowState copyWith({int? step, bool? submitting, String? error, bool clearError = false, BookingSummary? created}) =>
      BookingFlowState(draft: draft, step: step ?? this.step, submitting: submitting ?? this.submitting, error: clearError ? null : (error ?? this.error), created: created ?? this.created);
}

final bookingFlowProvider = NotifierProvider<BookingFlowController, BookingFlowState>(BookingFlowController.new);

class BookingFlowController extends Notifier<BookingFlowState> {
  static const int lastStep = 3;

  @override
  BookingFlowState build() {
    ref.watch(sessionUserIdProvider); // a half-filled booking never carries over to another account
    return BookingFlowState(draft: BookingDraft(type: 'SERVICE'));
  }

  void start({required String type, ServiceItem? service}) {
    final draft = BookingDraft(type: type);
    if (service != null) draft.setQty(service, 1);
    state = BookingFlowState(draft: draft);
  }

  void touch() => state = state.copyWith(clearError: true);

  void setQty(ServiceItem s, int qty) {
    state.draft.setQty(s, qty);
    touch();
  }

  bool next() {
    final problem = state.draft.validateStep(state.step);
    if (problem != null) {
      state = state.copyWith(error: problem);
      return false;
    }
    state = state.copyWith(step: (state.step + 1).clamp(0, lastStep), clearError: true);
    return true;
  }

  void back() => state = state.copyWith(step: (state.step - 1).clamp(0, lastStep), clearError: true);

  Future<BookingSummary?> submit() async {
    for (var s = 0; s < lastStep; s++) {
      final p = state.draft.validateStep(s);
      if (p != null) {
        state = state.copyWith(step: s, error: p);
        return null;
      }
    }
    state = state.copyWith(submitting: true, clearError: true);
    try {
      final created = await ref.read(bookingRepositoryProvider).create(state.draft);
      state = state.copyWith(submitting: false, created: created);
      ref.invalidate(myBookingsProvider);
      ref.invalidate(homeSummaryProvider);
      return created;
    } on ApiException catch (e) {
      state = state.copyWith(submitting: false, error: e.fieldErrors.values.isNotEmpty ? e.fieldErrors.values.first : e.message);
      return null;
    }
  }
}
