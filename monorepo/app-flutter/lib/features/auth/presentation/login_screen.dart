/// Sign in for customers and technicians (role decides the app experience), with optional OTP step.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../../shared/widgets/appliance_art.dart';
import '../domain/auth_entity.dart';
import 'auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  final _pw = TextEditingController();
  final _otp = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _id.dispose();
    _pw.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final otpStep = auth.status == AuthStatus.otpRequired;
    final t = Theme.of(context).textTheme;
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(children: [
          // Brand hero
          SizedBox(
            width: double.infinity,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(Radii.xxl + 8)),
              child: DecoratedBox(
                decoration: const BoxDecoration(gradient: AppColors.brandGradient),
                child: Stack(children: [
                  const DecorBubbles(opacity: 0.08),
                  Positioned(right: -34, top: top + 64, child: const SplitAcShowcase(width: 176, height: 124)),
                  Padding(
                    padding: EdgeInsets.fromLTRB(Space.page, top + Space.xl, Space.page, 96),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Radii.lg), boxShadow: AppShadows.raised),
                        child: const BrandLogo(height: 40),
                      ),
                      const SizedBox(height: Space.xxl),
                      SizedBox(width: 250, child: Text(otpStep ? 'Verify it’s you' : 'Welcome back 👋', style: t.headlineMedium?.copyWith(color: Colors.white))),
                      const SizedBox(height: 6),
                      SizedBox(
                        width: 210,
                        child: Text(otpStep ? 'Enter the 6-digit code we sent you.' : 'Sign in to book services or manage your jobs.',
                            style: t.bodyLarge?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
          // Form card overlapping the hero
          Transform.translate(
            offset: const Offset(0, -64),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: Space.page),
                  padding: const EdgeInsets.fromLTRB(Space.xl, Space.xxl, Space.xl, Space.lg),
                  decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(Radii.xxl), boxShadow: AppShadows.raised),
                  child: Form(
                    key: _form,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (_error != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: Space.lg),
                          padding: const EdgeInsets.all(Space.md),
                          decoration: BoxDecoration(color: AppColors.redSoft, borderRadius: BorderRadius.circular(Radii.md)),
                          child: Row(children: [
                            const Icon(Icons.error_outline, color: AppColors.red, size: 20),
                            const SizedBox(width: Space.sm),
                            Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.red, fontWeight: FontWeight.w600)))
                          ]),
                        ),
                      if (!otpStep) ...[
                        TextFormField(
                          controller: _id,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.username],
                          decoration: const InputDecoration(labelText: 'Mobile number or email', prefixIcon: Icon(Icons.person_outline_rounded)),
                          validator: Validators.identifier,
                        ),
                        const SizedBox(height: Space.lg),
                        TextFormField(
                          controller: _pw,
                          obscureText: _obscure,
                          autofillHints: const [AutofillHints.password],
                          onFieldSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                onPressed: () => setState(() => _obscure = !_obscure),
                                tooltip: _obscure ? 'Show password' : 'Hide password'),
                          ),
                          validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
                        ),
                        Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => context.push(AppRoutes.forgotPassword), child: const Text('Forgot password?'))),
                        const SizedBox(height: Space.sm),
                        PrimaryButton(label: 'Sign in', loading: _loading, onPressed: _submit),
                        const SizedBox(height: Space.xxl),
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text('New to Local Air Solutions?', style: t.bodyMedium),
                          TextButton(onPressed: () => context.push(AppRoutes.register), child: const Text('Create account')),
                        ]),
                      ] else ...[
                        TextFormField(
                          controller: _otp,
                          keyboardType: TextInputType.number,
                          maxLength: Limits.otpLength,
                          textAlign: TextAlign.center,
                          autofillHints: const [AutofillHints.oneTimeCode],
                          style: const TextStyle(fontSize: 26, letterSpacing: 12, fontWeight: FontWeight.w800),
                          decoration: const InputDecoration(counterText: '', hintText: '••••••'),
                          validator: (v) => (v?.length == Limits.otpLength) ? null : 'Enter the 6-digit code',
                        ),
                        const SizedBox(height: Space.lg),
                        PrimaryButton(
                            label: 'Verify & continue',
                            loading: _loading,
                            onPressed: () => _form.currentState!.validate() ? _run(() => ref.read(authControllerProvider.notifier).verifyOtp(_otp.text)) : null),
                        TextButton(onPressed: () => ref.read(authControllerProvider.notifier).cancelOtp(), child: const Text('Back to sign in')),
                      ],
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    _run(() => ref.read(authControllerProvider.notifier).login(_id.text, _pw.text));
  }
}
