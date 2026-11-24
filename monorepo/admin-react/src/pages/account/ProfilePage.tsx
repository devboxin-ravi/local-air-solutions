/**
 * My profile & password change.
 */

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChangePassword } from '@/hooks/useAccount';
import { changePasswordSchema } from '@/lib/validation';
import { useFormErrors } from '@/hooks/useFormErrors';
import { formatDateTime, initials } from '@/lib/utils';
import { Badge, Field, KeyValue, PageHeader, SectionCard } from '@/components/common';
import { Avatar, Button, Input } from '@/components/ui/primitives';

export default function ProfilePage() {
  const { user } = useAuth();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const { errors, validate, clear, fromServer } = useFormErrors();

  const submit = () => {
    const parsed = validate(changePasswordSchema, { current, next, confirm });
    if (!parsed) return;
    change.mutate(
      { current: parsed.current, next: parsed.next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
        },
        onError: (e) => fromServer(e),
      },
    );
  };

  if (!user) return null;
  return (
    <>
      <PageHeader title="My Profile" description="Account details and security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Account">
          <div className="mb-5 flex items-center gap-4">
            <Avatar fallback={initials(user.name)} className="h-14 w-14 text-base" />
            <div>
              <p className="font-display text-lg font-bold text-brand-navy">{user.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r} tone="blue">{r.replace('_', ' ')}</Badge>)}</div>
            </div>
          </div>
          <KeyValue items={[{ label: 'Email', value: user.email ?? '—' }, { label: 'Mobile', value: user.mobile }, { label: 'Access', value: user.isCompanyWide ? 'All branches' : 'Own branch' }, { label: 'Last login', value: formatDateTime(user.lastLoginAt) }]} />
        </SectionCard>
        <SectionCard title="Change password" description="All other sessions are signed out after a change.">
          <div className="space-y-4">
            <Field label="Current password" required error={errors.current} htmlFor="pw-current">
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); clear('current'); }} />
            </Field>
            <Field label="New password" required error={errors.next} htmlFor="pw-next" hint="At least 8 characters with a letter and a number">
              <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); clear('next'); }} />
            </Field>
            <Field label="Confirm new password" required error={errors.confirm} htmlFor="pw-confirm">
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); clear('confirm'); }} />
            </Field>
            <Button loading={change.isPending} onClick={submit}><KeyRound /> Update password</Button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
