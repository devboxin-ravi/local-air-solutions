/**
 * My profile & password change.
 */

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChangePassword } from '@/hooks/useAccount';
import { passwordField } from '@/lib/validation';
import { formatDateTime, initials } from '@/lib/utils';
import { Badge, Field, KeyValue, PageHeader, SectionCard } from '@/components/common';
import { Avatar, Button, Input } from '@/components/ui/primitives';

export default function ProfilePage() {
  const { user } = useAuth();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string>();

  const submit = () => {
    const r = passwordField.safeParse(next);
    if (!r.success) return setErr(r.error.issues[0].message);
    if (next !== confirm) return setErr('Passwords do not match');
    setErr(undefined);
    change.mutate({ current, next }, { onSuccess: () => { setCurrent(''); setNext(''); setConfirm(''); } });
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
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
            <Field label="New password" error={err}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
            <Button disabled={!current || !next} loading={change.isPending} onClick={submit}><KeyRound /> Update password</Button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
