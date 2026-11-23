/// Technician job data access with offline cache (Hive) for job lists and dashboard.
library;

import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/job_entities.dart';

Job jobFromJson(Map<String, dynamic> j) {
  final snap = (j['addressSnapshot'] as Map?) ?? const {};
  final addr = j['address'] as Map?;
  final assignments = (j['assignments'] as List?) ?? const [];
  final current = assignments.cast<Map>().where((a) => a['isCurrent'] != false).toList();
  double? toD(Object? v) => v == null ? null : double.tryParse('$v');
  return Job(
    id: (j['id'] as num).toInt(),
    number: j['bookingNumber'] as String,
    type: j['bookingType'] as String? ?? 'SERVICE',
    status: j['status'] as String,
    assignmentStatus: current.isNotEmpty ? current.first['status'] as String : 'ASSIGNED',
    scheduledDate: j['scheduledDate'] as String,
    scheduledTime: j['scheduledTime'] as String?,
    customerName: (j['customer'] as Map)['fullName'] as String,
    customerPhone: '${(j['customer'] as Map)['countryCode'] ?? '+91'}${(j['customer'] as Map)['mobile']}',
    address: [snap['line1'], snap['line2'], snap['landmark'], snap['city'], snap['pincode']].where((s) => s != null && '$s'.isNotEmpty).join(', '),
    area: (addr?['serviceArea'] as Map?)?['name'] as String? ?? (addr?['city'] as Map?)?['name'] as String?,
    latitude: toD(snap['latitude']),
    longitude: toD(snap['longitude']),
    problemDescription: j['problemDescription'] as String?,
    instructions: j['instructions'] as String?,
    productName: (j['product'] as Map?)?['name'] as String?,
    items: ((j['items'] as List?) ?? const [])
        .map((e) => JobItem(id: ((e as Map)['id'] as num).toInt(), name: e['serviceName'] as String, quantity: (e['quantity'] as num).toInt(), isPerformed: e['isPerformed'] as bool? ?? false))
        .toList(),
    notes: ((j['notes'] as List?) ?? const []).map((e) => (note: (e as Map)['note'] as String, author: ((e['author'] as Map?)?['name'] as String?) ?? '', at: e['createdAt'] as String)).toList(),
    photos: ((j['attachments'] as List?) ?? const []).map((e) => (kind: (e as Map)['kind'] as String, path: e['filePath'] as String)).toList(),
  );
}

class JobRepository {
  JobRepository({ApiClient? client}) : _api = client ?? ApiClient.instance;
  final ApiClient _api;

  Future<Box<String>> _box() => Hive.isBoxOpen(AppConstants.hiveBoxCache) ? Future.value(Hive.box<String>(AppConstants.hiveBoxCache)) : Hive.openBox<String>(AppConstants.hiveBoxCache);

  /// Network-first with cache fallback so technicians can still see jobs offline.
  Future<({List<Job> jobs, bool fromCache})> jobs(String scope) async {
    final key = '${AppConstants.cacheTechJobsPrefix}$scope';
    try {
      final raw = await _api.get(ApiConstants.techJobs, query: {'scope': scope}, parse: (d) => d as List);
      await (await _box()).put(key, jsonEncode(raw));
      return (jobs: raw.map((e) => jobFromJson(e as Map<String, dynamic>)).toList(), fromCache: false);
    } on ApiException catch (e) {
      final cached = (await _box()).get(key);
      if (e.isNetwork && cached != null) {
        return (jobs: (jsonDecode(cached) as List).map((e) => jobFromJson(e as Map<String, dynamic>)).toList(), fromCache: true);
      }
      rethrow;
    }
  }

  Future<TechDashboard> dashboard() async {
    TechDashboard parse(Map j) => TechDashboard(
          today: (j['todayJobs'] as num).toInt(),
          pending: (j['pending'] as num).toInt(),
          accepted: (j['accepted'] as num).toInt(),
          inProgress: (j['inProgress'] as num).toInt(),
          completed: (j['completed'] as num).toInt(),
        );
    try {
      final raw = await _api.get(ApiConstants.techDashboard, parse: (d) => d as Map<String, dynamic>);
      await (await _box()).put(AppConstants.cacheTechDashboard, jsonEncode(raw));
      return parse(raw);
    } on ApiException catch (e) {
      final cached = (await _box()).get(AppConstants.cacheTechDashboard);
      if (e.isNetwork && cached != null) return parse(jsonDecode(cached) as Map);
      rethrow;
    }
  }

  Future<Job> job(int id) => _api.get(ApiConstants.techJob(id), parse: (d) => jobFromJson(d as Map<String, dynamic>));

  Future<Job> respond(int id, bool accept, {String? reason}) => _api.post(ApiConstants.techRespond(id), body: {'accept': accept, 'reason': reason}, parse: (d) => jobFromJson(d as Map<String, dynamic>));

  Future<Job> setStatus(int id, String status, {String? note}) => _api.post(ApiConstants.techStatus(id), body: {'status': status, 'note': note}, parse: (d) => jobFromJson(d as Map<String, dynamic>));

  Future<Job> complete(int id, {required List<int> performedItemIds, String? note, String? otp}) => _api.post(ApiConstants.techComplete(id),
      body: {'performedItemIds': performedItemIds, 'note': (note?.trim().isEmpty ?? true) ? null : note!.trim(), if (otp != null && otp.isNotEmpty) 'completionOtp': otp}, parse: (d) => jobFromJson(d as Map<String, dynamic>));

  Future<void> addNote(int id, String note) => _api.post(ApiConstants.techNotes(id), body: {'note': note.trim()}, parse: (_) {});

  Future<void> uploadPhotos(int id, String kind, List<String> paths) => _api.upload(ApiConstants.techPhotos(id), field: 'files', files: paths, fields: {'kind': kind}, parse: (_) {});
}
