/// Customer registration: name, mobile, optional email, password, state/city, address & PIN.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../catalog/presentation/catalog_providers.dart';
import 'auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _pw = TextEditingController();
  final _line1 = TextEditingController();
  final _pin = TextEditingController();
  int? _stateId;
  int? _cityId;
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _mobile, _email, _pw, _line1, _pin]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).register(
            fullName: _name.text,
            mobile: _mobile.text,
            email: _email.text,
            password: _pw.text,
            address: {'label': 'Home', 'line1': _line1.text.trim(), 'stateId': _stateId, 'cityId': _cityId, 'pincode': _pin.text.trim()},
          );
      // Router redirect takes the user into the app once authenticated.
    } on ApiException catch (e) {
      setState(() => _error = e.fieldErrors.isNotEmpty ? e.fieldErrors.values.first : e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final states = ref.watch(statesProvider);
    final cities = _stateId == null ? null : ref.watch(citiesProvider(_stateId!));
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(Space.page), children: [
            Text('Book trusted AC & appliance services in minutes.', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.slate)),
            const SizedBox(height: Space.xl),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: Space.lg),
                child: Text(_error!, style: const TextStyle(color: AppColors.red, fontWeight: FontWeight.w600)),
              ),
            TextFormField(controller: _name, textCapitalization: TextCapitalization.words, maxLength: Limits.nameMax, decoration: const InputDecoration(labelText: 'Full name *', prefixIcon: Icon(Icons.person_outline), counterText: ''), validator: Validators.name),
            const SizedBox(height: Space.lg),
            TextFormField(controller: _mobile, keyboardType: TextInputType.phone, maxLength: 10, decoration: const InputDecoration(labelText: 'Mobile number *', prefixText: '${AppConstants.countryCode} ', counterText: ''), validator: Validators.mobile),
            const SizedBox(height: Space.lg),
            TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)', prefixIcon: Icon(Icons.mail_outline)), validator: Validators.optionalEmail),
            const SizedBox(height: Space.lg),
            TextFormField(
              controller: _pw,
              obscureText: _obscure,
              decoration: InputDecoration(labelText: 'Password *', helperText: Messages.password, prefixIcon: const Icon(Icons.lock_outline), suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure))),
              validator: Validators.password,
            ),
            const SizedBox(height: Space.xxl),
            Text('Service address', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: Space.md),
            DropdownButtonFormField<int>(
              initialValue: _stateId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'State *'),
              items: (states.value ?? []).map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
              onChanged: (v) => setState(() {
                _stateId = v;
                _cityId = null;
              }),
              validator: (v) => v == null ? Messages.required : null,
            ),
            LookupStatus(loading: states.isLoading, failed: states.hasError && !states.isLoading, onRetry: () => ref.invalidate(statesProvider)),
            const SizedBox(height: Space.lg),
            DropdownButtonFormField<int>(
              key: ValueKey(_stateId),
              initialValue: _cityId,
              isExpanded: true,
              decoration: InputDecoration(labelText: 'City *', helperText: cities?.value?.isEmpty == true ? Messages.noCitiesForState : null),
              items: (cities?.value ?? []).map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
              onChanged: (v) => setState(() => _cityId = v),
              validator: (v) => v == null ? Messages.required : null,
            ),
            if (cities != null) LookupStatus(loading: cities.isLoading, failed: cities.hasError && !cities.isLoading, onRetry: () => ref.invalidate(citiesProvider(_stateId!))),
            const SizedBox(height: Space.lg),
            TextFormField(controller: _line1, maxLength: Limits.addressMax, decoration: const InputDecoration(labelText: 'House / street / area *', counterText: ''), validator: Validators.length(Limits.addressMin, Limits.addressMax, label: 'Address')),
            const SizedBox(height: Space.lg),
            TextFormField(controller: _pin, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(labelText: 'PIN code *', counterText: ''), validator: Validators.pincode),
            const SizedBox(height: Space.xxl),
            PrimaryButton(label: 'Create account', loading: _loading, onPressed: _submit),
            const SizedBox(height: Space.lg),
          ]),
        ),
      ),
    );
  }
}
