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
import '../data/location_repository.dart';
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

  // Current-location autofill.
  bool _locating = false;
  LocationException? _locError;
  double? _lat;
  double? _lng;
  /// Bumped after autofill so the State / City dropdowns rebuild with the new values.
  int _fillVersion = 0;

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
        if (_lat != null && _lng != null) ...{'latitude': _lat, 'longitude': _lng},
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

  /// Reads the GPS position, then fills address, PIN, state and city from it.
  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _locError = null;
    });
    try {
      final loc = await ref.read(locationRepositoryProvider).current();
      final catalog = ref.read(catalogRepositoryProvider);
      final state = matchByName(await catalog.states(), (NamedRef s) => s.name, loc.state);
      final city = state == null ? null : matchByName(await catalog.cities(state.id), (NamedRef c) => c.name, loc.city);
      if (!mounted) return;
      setState(() {
        _lat = loc.latitude;
        _lng = loc.longitude;
        if (_line1.text.trim().isEmpty && loc.line1 != null) _line1.text = loc.line1!;
        if (loc.line2 != null) _line2.text = loc.line2!;
        if (_landmark.text.trim().isEmpty && loc.landmark != null) _landmark.text = loc.landmark!;
        if (loc.pincode != null) _pin.text = loc.pincode!;
        if (state != null) {
          _stateId = state.id;
          _cityId = city?.id;
        }
        _fillVersion++;
      });
      showAppSnack(context, state == null || city == null ? Messages.locationOutsideArea : Messages.locationFilled);
    } on LocationException catch (e) {
      if (mounted) setState(() => _locError = e);
    } catch (_) {
      if (mounted) setState(() => _locError = const LocationException(Messages.locationFailed));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _openLocationSettings() async {
    final repo = ref.read(locationRepositoryProvider);
    await repo.openSettings(serviceOff: !await repo.isServiceEnabled());
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
        OutlinedButton.icon(
          onPressed: _locating ? null : _useCurrentLocation,
          icon: _locating ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location_rounded, size: 20),
          label: Text(_locating ? LocationConfig.detectingLabel : LocationConfig.useCurrentLabel),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: AppColors.blue, side: const BorderSide(color: AppColors.blue)),
        ),
        if (_locError != null)
          Padding(
            padding: const EdgeInsets.only(top: Space.sm),
            child: Row(children: [
              const Icon(Icons.info_outline_rounded, size: 18, color: AppColors.slate),
              const SizedBox(width: Space.sm),
              Expanded(child: Text(_locError!.message, style: Theme.of(context).textTheme.bodySmall)),
              if (_locError!.openSettings) TextButton(onPressed: _openLocationSettings, child: const Text(LocationConfig.settingsAction)),
            ]),
          ),
        const SizedBox(height: Space.lg),
        TextFormField(controller: _line1, maxLength: Limits.addressMax, decoration: const InputDecoration(labelText: 'House / flat, building, street *', counterText: ''), validator: Validators.length(Limits.addressMin, Limits.addressMax, label: 'Address')),
        const SizedBox(height: Space.md),
        TextFormField(controller: _line2, maxLength: Limits.addressMax, decoration: const InputDecoration(labelText: 'Area / locality', counterText: '')),
        const SizedBox(height: Space.md),
        TextFormField(controller: _landmark, maxLength: 200, decoration: const InputDecoration(labelText: 'Landmark', counterText: '')),
        const SizedBox(height: Space.md),
        DropdownButtonFormField<int>(
          key: ValueKey('state-$_fillVersion'),
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
          key: ValueKey('city-$_stateId-$_fillVersion'),
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
