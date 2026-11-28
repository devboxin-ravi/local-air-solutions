/// Technician job entities and field-workflow rules. Pure Dart.
library;

class JobItem {
  const JobItem({required this.id, required this.name, required this.quantity, required this.isPerformed, this.isExtra = false});
  final int id;
  final String name;
  final int quantity;
  final bool isPerformed;

  /// Added on site, over and above what was booked.
  final bool isExtra;
}

/// A service the technician can add as extra work.
typedef ExtraService = ({int id, String name, String code, double price});

class Job {
  const Job({
    required this.id,
    required this.number,
    required this.type,
    required this.status,
    required this.assignmentStatus,
    required this.scheduledDate,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    required this.items,
    this.scheduledTime,
    this.area,
    this.latitude,
    this.longitude,
    this.problemDescription,
    this.instructions,
    this.productName,
    this.branchId,
    this.notes = const [],
    this.photos = const [],
  });

  final int id;
  final String number;
  final String type;
  final String status;
  final String assignmentStatus;
  final String scheduledDate;
  final String? scheduledTime;
  final String customerName;
  final String customerPhone;
  final String address;
  final String? area;
  final double? latitude;
  final double? longitude;
  final String? problemDescription;
  final String? instructions;
  final String? productName;
  final int? branchId;
  final List<JobItem> items;
  final List<({String note, String author, String at, String kind})> notes;
  final List<({String kind, String path})> photos;

  /// The technician is at the site: extra work can be added or removed.
  bool get canAddExtraWork => status == 'ARRIVED' || status == 'IN_PROGRESS';
  bool get canRecordFindings => canAddExtraWork || status == 'COMPLETED';

  bool get hasCoordinates => latitude != null && longitude != null;
  String get title => items.isNotEmpty ? items.map((i) => i.name).join(', ') : (problemDescription ?? 'Repair job');

  /// Next field action available to the technician, or null.
  JobAction? get nextAction => switch (status) {
        'ASSIGNED' => JobAction.respond,
        'ACCEPTED' => JobAction.onTheWay,
        'ON_THE_WAY' => JobAction.arrived,
        'ARRIVED' => JobAction.start,
        'IN_PROGRESS' => JobAction.complete,
        _ => null,
      };
}

enum JobAction {
  respond('Accept job', null),
  onTheWay('I’m on the way', 'ON_THE_WAY'),
  arrived('I’ve arrived', 'ARRIVED'),
  start('Start work', 'IN_PROGRESS'),
  complete('Complete job', null);

  const JobAction(this.label, this.targetStatus);
  final String label;
  final String? targetStatus;
}

class TechDashboard {
  const TechDashboard({required this.today, required this.pending, required this.accepted, required this.inProgress, required this.completed});
  final int today;
  final int pending;
  final int accepted;
  final int inProgress;
  final int completed;
}
