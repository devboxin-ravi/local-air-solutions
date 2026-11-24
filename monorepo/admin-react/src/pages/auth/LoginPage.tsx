/**
 * Admin login: centered card on a soft branded background, sign-in by username or email,
 * show/hide password, OTP step, lockout/error feedback.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { AlertCircle, Copyright, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import { LIMITS, MESSAGES, PATTERNS } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { BrandLogo, Field } from '@/components/common';
import { Button, Input } from '@/components/ui/primitives';

type Method = 'username' | 'email';

const schemaFor = (method: Method) =>
  z.object({
    identifier:
      method === 'username'
        ? z.string().trim().toLowerCase().regex(PATTERNS.USERNAME, MESSAGES.USERNAME)
        : z.string().trim().toLowerCase().email(MESSAGES.EMAIL).max(LIMITS.EMAIL_MAX),
    password: z.string().min(1, 'Enter your password'),
  });

type LoginForm = { identifier: string; password: string };

const DEVELOPER_NAME = 'DeveloperBox AI Factory';

/** Decorative background: soft brand-tinted blobs and flowing waves. */
const LoginBackground = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0 bg-gradient-to-br from-[#F3F7FD] via-white to-[#F6FAF0]" />
    <div className="absolute -left-10 top-16 h-[360px] w-[360px] rounded-full bg-brand-green-200/40 blur-3xl" />
    <div className="absolute left-[9%] top-[60px] h-[350px] w-[350px] rounded-full bg-gradient-to-br from-brand-blue-100/70 to-brand-green-100/70" />
    <div className="absolute right-[11%] top-[42px] h-[256px] w-[256px] rounded-full bg-gradient-to-br from-brand-green-100/70 to-brand-blue-50" />
    <div className="absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full bg-amber-100/40 blur-3xl" />
    <div className="absolute bottom-0 left-1/3 h-[300px] w-[500px] rounded-full bg-brand-blue-100/50 blur-3xl" />
    <svg className="absolute inset-x-0 top-0 h-48 w-full" viewBox="0 0 1440 200" preserveAspectRatio="none">
      <path d="M0 70 C 260 10, 420 120, 720 70 S 1180 10, 1440 40" fill="none" stroke="#AFCBF4" strokeOpacity="0.55" strokeWidth="3" />
      <path d="M0 110 C 300 60, 520 160, 820 100 S 1240 60, 1440 120" fill="none" stroke="#CDE5A6" strokeOpacity="0.6" strokeWidth="2.5" />
    </svg>
    <svg className="absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 1440 160" preserveAspectRatio="none">
      <path d="M0 90 C 240 20, 480 60, 720 70 S 1200 100, 1440 30 L 1440 160 L 0 160 Z" fill="#EEF4FD" fillOpacity="0.9" />
      <path d="M0 120 C 300 70, 560 120, 860 110 S 1260 80, 1440 100 L 1440 160 L 0 160 Z" fill="#F4F9EC" fillOpacity="0.9" />
    </svg>
  </div>
);

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.DASHBOARD;
  const [method, setMethod] = useState<Method>('username');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpUser, setOtpUser] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const form = useForm<LoginForm>({ resolver: zodResolver(schemaFor(method)), defaultValues: { identifier: '', password: '' } });
  const e = form.formState.errors;

  const switchMethod = (m: Method) => {
    if (m === method) return;
    setMethod(m);
    setError(null);
    form.reset({ identifier: '', password: form.getValues('password') });
  };

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await login(v.identifier.trim().toLowerCase(), v.password);
      if (r.otpRequired) setOtpUser(r.userId);
      else navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  const onVerify = async () => {
    if (!otpUser) return;
    setOtpLoading(true);
    setError(null);
    try {
      await verifyOtp(otpUser, otp);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setOtpLoading(false);
    }
  };

  const fieldClass = 'h-12 border-slate-200 bg-slate-50/80 pl-11 text-[15px] shadow-none focus-visible:bg-white';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <LoginBackground />

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-[460px] rounded-2xl border border-white/80 bg-white/95 px-6 pb-8 pt-6 shadow-[0_20px_60px_-15px_rgba(15,31,61,0.18)] backdrop-blur sm:px-8"
      >
        <div className="flex justify-center pb-5">
          <BrandLogo className="h-16 sm:h-[72px]" />
        </div>
        <div className="h-px bg-slate-200" />

        {otpUser && <p className="mt-6 text-center text-[15px] text-slate-500">Verify Your Sign In</p>}

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {!otpUser ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <p className="mb-2 text-[13.5px] font-semibold text-slate-700">Sign In With</p>
              <div role="tablist" aria-label="Sign in method" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {(['username', 'email'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => switchMethod(m)}
                    className={cn(
                      'h-10 rounded-lg text-[14.5px] font-medium transition-all duration-micro',
                      method === m ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-navy',
                    )}
                  >
                    {m === 'username' ? 'Username' : 'Email'}
                  </button>
                ))}
              </div>
            </div>

            <Field label={method === 'username' ? 'Username' : 'Email'} error={e.identifier?.message} htmlFor="identifier">
              <div className="relative">
                {method === 'username' ? (
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
                ) : (
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
                )}
                <Input
                  id="identifier"
                  key={method}
                  type={method === 'username' ? 'text' : 'email'}
                  inputMode={method === 'username' ? 'text' : 'email'}
                  maxLength={method === 'username' ? LIMITS.USERNAME_MAX : LIMITS.EMAIL_MAX}
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="username"
                  autoFocus
                  placeholder={method === 'username' ? 'Your username' : 'Email address'}
                  className={fieldClass}
                  aria-invalid={!!e.identifier}
                  {...form.register('identifier')}
                />
              </div>
            </Field>

            <Field label="Password" error={e.password?.message} htmlFor="password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  className={cn(fieldClass, 'pr-12')}
                  aria-invalid={!!e.password}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 transition-colors hover:text-brand-navy"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" className="h-12 w-full text-[15.5px]" loading={form.formState.isSubmitting}>
              Sign In
            </Button>

            <div className="text-center">
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-[13.5px] font-medium text-brand-blue hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-5">
            <Field label="Verification Code" hint="Enter the 6-digit code sent to your registered email.">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, ''))}
                className="h-12 bg-slate-50/80 text-center font-display text-2xl tracking-[0.5em]"
                autoFocus
              />
            </Field>
            <Button size="lg" className="h-12 w-full" loading={otpLoading} disabled={otp.length !== 6} onClick={onVerify}>
              Verify & Sign In
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOtpUser(null);
                setOtp('');
              }}
            >
              Back to sign in
            </Button>
          </div>
        )}
      </motion.div>

      <p className="relative mt-6 flex items-center gap-1.5 text-[13.5px] text-slate-500">
        <Copyright className="h-3.5 w-3.5" /> Developed by -{' '}
        <span className="font-medium text-brand-blue">{DEVELOPER_NAME}</span>
      </p>
    </div>
  );
}
