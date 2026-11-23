/// Add / edit address bottom sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../catalog/domain/catalog_entities.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../domain/account_entities.dart';
import 'account_providers.dart';

Future<void> showAddressSheet(BuildContext context, WidgetRef ref, {Address? existing}) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom), child: _AddressForm(existing: existing)),
    );

class _AddressForm extends ConsumerStatefulWidget {
  const _AddressForm({this.existing});
  final Address? existing;
  @override
  ConsumerState<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<_AddressForm> {
  final _form = GlobalKey<FormState>();
  late final _label = TextEditingController(text: widget.existing?.label ?? 'Home');
  late final _line1 = TextEditingController(text: widget.existing?.line1 ?? '');
  late final _line2 = TextEditingController(text: widget.existing?.line2 ?? '');
  late final _landmark = TextEditingController(text: widget.existing?.landmark ?? '');
  late final _pin = TextEditingController(text: widget.existing?.pincode ?? '');
  late int? _stateId = widget.existing?.stateId;
  late int? _cityId = widget.existing?.cityId;
  late bool _default = widget.existing?.isDefault ?? false;
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_label, _line1, _line2, _landmark, _pin]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(accountRepositoryProvider).saveAddress({
        'label': _label.text.trim(),
        'line1': _line1.text.trim(),
        'line2': _line2.text.trim().isEmpty ? null : _line2.text.trim(),
        'landmark': _landmark.text.trim().isEmpty ? null : _landmark.text.trim(),
        'stateId': _stateId,
        'cityId': _cityId,
        'pincode': _pin.text.trim(),
        'isDefault': _default,
      }, id: widget.existing?.id);
      ref.invalidate(addressesProvider);
      ref.invalidate(addressBranchesProvider);
      ref.invalidate(profileProvider);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.fieldErrors.values.firstOrNull ?? e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statesAsync = ref.watch(statesProvider);
    final citiesAsync = _stateId == null ? null : ref.watch(citiesProvider(_stateId!));
    final List<NamedRef> states = statesAsync.value ?? const [];
    final List<NamedRef> cities = citiesAsync?.value ?? const [];
    return Form(
      key: _form,
      child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.page), children: [
        Text(widget.existing == null ? 'Add address' : 'Edit address', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: Space.lg),
        Wrap(
          spacing: Space.sm,
          children: ['Home', 'Office', 'Shop', 'Other'].map((l) => ChoiceChip(label: Text(l), selected: _label.text == l, onSelected: (_) => setState(() => _label.text = l))).toList(),
        ),
        const SizedBox(height: Space.lg),
        TextFormField(controller: _line1, maxLength: Limits.addressMax, decoration: const InputDecoration(labelText: 'House / flat, building, street *', counterText: ''), validator: Validators.length(Limits.addressMin, Limits.addressMax, label: 'Address')),
        const SizedBox(height: Space.md),
        TextFormField(controller: _line2, maxLength: Limits.addressMax, decoration: const InputDecoration(labelText: 'Area / locality', counterText: '')),
        const SizedBox(height: Space.md),
        TextFormField(controller: _landmark, maxLength: 200, decoration: const InputDecoration(labelText: 'Landmark', counterText: '')),
        const SizedBox(height: Space.md),
        DropdownButtonFormField<int>(
          initialValue: _stateId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'State *'),
          items: states.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
          onChanged: (v) => setState(() {
            _stateId = v;
            _cityId = null;
          }),
          validator: (v) => v == null ? Messages.required : null,
        ),
        LookupStatus(loading: statesAsync.isLoading, failed: statesAsync.hasError && !statesAsync.isLoading, onRetry: () => ref.invalidate(statesProvider)),
        const SizedBox(height: Space.md),
        DropdownButtonFormField<int>(
          key: ValueKey(_stateId),
          initialValue: cities.any((c) => c.id == _cityId) ? _cityId : null,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'City *'),
          items: cities.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
          onChanged: (v) => setState(() => _cityId = v),
          validator: (v) => v == null ? Messages.required : null,
        ),
        if (citiesAsync != null) LookupStatus(loading: citiesAsync.isLoading, failed: citiesAsync.hasError && !citiesAsync.isLoading, onRetry: () => ref.invalidate(citiesProvider(_stateId!))),
        const SizedBox(height: Space.md),
        TextFormField(controller: _pin, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(labelText: 'PIN code *', counterText: ''), validator: Validators.pincode),
        SwitchListTile.adaptive(contentPadding: EdgeInsets.zero, value: _default, onChanged: (v) => setState(() => _default = v), title: const Text('Set as default address'), activeTrackColor: AppColors.green),
        const SizedBox(height: Space.md),
        PrimaryButton(label: 'Save address', loading: _saving, onPressed: _save),
      ]),
    );
  }
}
