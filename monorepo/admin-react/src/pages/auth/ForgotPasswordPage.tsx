/**
 * Password reset: request OTP, then set a new password.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useRequestPasswordReset, useResetPassword } from '@/hooks/useAccount';
import { passwordField } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { BrandLogo, Field } from '@/components/common';
import { Button, Card, Input } from '@/components/ui/primitives';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<string>();

  const request = useRequestPasswordReset((m) => { toast.success(m); setStep('reset'); });
  const reset = useResetPassword((m) => { toast.success(m); navigate(ROUTES.LOGIN); });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue-50 via-white to-brand-green-50 px-4">
      <Card className="w-full max-w-md p-8">
        <BrandLogo className="mb-8 h-11" />
        <h1 className="text-2xl font-extrabold">Reset password</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{step === 'request' ? 'We’ll send a verification code to the email on your account.' : 'Enter the code and choose a new password.'}</p>
        <div className="mt-6 space-y-4">
          <Field label="Email or mobile">
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={step === 'reset'} autoFocus />
          </Field>
          {step === 'reset' && (
            <>
              <Field label="Verification code">
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="New password" error={pwError}>
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          )}
          {step === 'request' ? (
            <Button className="w-full" loading={request.isPending} disabled={identifier.trim().length < 3} onClick={() => request.mutate(identifier.trim())}>
              Send code
            </Button>
          ) : (
            <Button
              className="w-full"
              loading={reset.isPending}
              disabled={code.length !== 6}
              onClick={() => {
                const r = passwordField.safeParse(password);
                setPwError(r.success ? undefined : r.error.issues[0].message);
                if (r.success) reset.mutate({ identifier: identifier.trim(), code, password });
              }}
            >
              Update password
            </Button>
          )}
          <Link to={ROUTES.LOGIN} className="flex items-center justify-center gap-1.5 pt-2 text-[13px] font-semibold text-brand-blue hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
