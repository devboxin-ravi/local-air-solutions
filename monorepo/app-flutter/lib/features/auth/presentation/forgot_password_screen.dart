/// Password reset via OTP.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import 'auth_provider.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  final _code = TextEditingController();
  final _pw = TextEditingController();
  bool _sent = false;
  bool _loading = false;

  @override
  void dispose() {
    _id.dispose();
    _code.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    final repo = ref.read(authRepositoryProvider);
    try {
      if (!_sent) {
        final msg = await repo.forgotPassword(_id.text);
        if (!mounted) return;
        showAppSnack(context, msg);
        setState(() => _sent = true);
      } else {
        final msg = await repo.resetPassword(_id.text, _code.text, _pw.text);
        if (!mounted) return;
        showAppSnack(context, msg);
        context.go(AppRoutes.login);
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Reset password')),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(Space.page), children: [
            Text(_sent ? 'Enter the code and choose a new password.' : 'We’ll send a verification code to your registered email.', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.slate)),
            const SizedBox(height: Space.xl),
            TextFormField(controller: _id, enabled: !_sent, decoration: const InputDecoration(labelText: 'Mobile number or email'), validator: Validators.identifier),
            if (_sent) ...[
              const SizedBox(height: Space.lg),
              TextFormField(controller: _code, keyboardType: TextInputType.number, maxLength: Limits.otpLength, decoration: const InputDecoration(labelText: 'Verification code', counterText: ''), validator: (v) => v?.length == Limits.otpLength ? null : 'Enter the 6-digit code'),
              const SizedBox(height: Space.lg),
              TextFormField(controller: _pw, obscureText: true, decoration: const InputDecoration(labelText: 'New password', helperText: Messages.password), validator: Validators.password),
            ],
            const SizedBox(height: Space.xxl),
            PrimaryButton(label: _sent ? 'Update password' : 'Send code', loading: _loading, onPressed: _go),
          ]),
        ),
      );
}
