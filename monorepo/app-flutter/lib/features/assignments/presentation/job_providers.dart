/// Technician job providers and job action controller.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/job_repository.dart';
import '../domain/job_entities.dart';
import '../../auth/presentation/auth_provider.dart';

final jobRepositoryProvider = Provider<JobRepository>((_) => JobRepository());
final techDashboardProvider = FutureProvider<TechDashboard>((ref) {
  ref.watch(sessionUserIdProvider);
  return ref.read(jobRepositoryProvider).dashboard();
});
final techJobsProvider = FutureProvider.family<({List<Job> jobs, bool fromCache}), String>((ref, scope) {
  ref.watch(sessionUserIdProvider);
  return ref.read(jobRepositoryProvider).jobs(scope);
});
final jobProvider = FutureProvider.family<Job, int>((ref, id) {
  ref.watch(sessionUserIdProvider);
  return ref.read(jobRepositoryProvider).job(id);
});

/// Runs a job action, then refreshes every job view.
class JobActions {
  JobActions(this._ref);
  final Ref _ref;

  JobRepository get _repo => _ref.read(jobRepositoryProvider);

  void _refresh(int id) {
    _ref.invalidate(jobProvider(id));
    _ref.invalidate(techJobsProvider);
    _ref.invalidate(techDashboardProvider);
  }

  Future<void> respond(int id, bool accept, {String? reason}) async {
    await _repo.respond(id, accept, reason: reason);
    _refresh(id);
  }

  Future<void> setStatus(int id, String status) async {
    await _repo.setStatus(id, status);
    _refresh(id);
  }

  Future<void> complete(int id, {required List<int> performed, String? note, String? otp}) async {
    await _repo.complete(id, performedItemIds: performed, note: note, otp: otp);
    _refresh(id);
  }

  Future<void> addNote(int id, String note) async {
    await _repo.addNote(id, note);
    _ref.invalidate(jobProvider(id));
  }

  Future<void> uploadPhotos(int id, String kind, List<String> paths) async {
    await _repo.uploadPhotos(id, kind, paths);
    _ref.invalidate(jobProvider(id));
  }
}

final jobActionsProvider = Provider<JobActions>((ref) => JobActions(ref));
