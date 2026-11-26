/**
 * My profile: photo, account details and password change — stacked in one column.
 */

import { useEffect, useRef, useState } from 'react';
import { AtSign, Building2, Camera, CheckCircle2, Circle, Clock, Eye, EyeOff, KeyRound, Mail, Phone, RotateCcw, Save, ShieldCheck, Trash2, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAvatar, useChangePassword, useUpdateProfile } from '@/hooks/useAccount';
import { errorMessage } from '@/hooks/useApi';
import { useFormErrors } from '@/hooks/useFormErrors';
import { changePasswordSchema, profileSchema } from '@/lib/validation';
import { IMAGE_UPLOAD, LIMITS, PLACEHOLDERS } from '@/constants/ui';
import { assetUrl, cn, formatDateTime, humanize, initials, passwordChecks } from '@/lib/utils';
import { Field, PageHeader } from '@/components/common';
import { Avatar, Button, Card, Input } from '@/components/ui/primitives';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user } = useAuth();
  const change = useChangePassword();
  const avatar = useAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const { errors, validate, clear, fromServer } = useFormErrors();

  // Editable account details
  const saveProfile = useUpdateProfile();
  const profileErrors = useFormErrors();
  const initial = { name: user?.name ?? '', email: user?.email ?? '', mobile: user?.mobile ?? '', username: user?.username ?? '' };
  const [profile, setProfile] = useState(initial);
  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email ?? '', mobile: user.mobile, username: user.username ?? '' });
  }, [user]);
  const dirty = JSON.stringify(profile) !== JSON.stringify(initial);
  const setField = (k: keyof typeof profile, v: string) => {
    setProfile((p) => ({ ...p, [k]: v }));
    profileErrors.clear(k);
  };
  const submitProfile = () => {
    const parsed = profileErrors.validate(profileSchema, profile);
    if (!parsed) return;
    saveProfile.mutate(
      { name: parsed.name, mobile: parsed.mobile, email: parsed.email || null, username: parsed.username || null },
      {
        onError: (e) => {
          profileErrors.fromServer(e);
          toast.error(errorMessage(e));
        },
      },
    );
  };

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

  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!(IMAGE_UPLOAD.MIME_TYPES as readonly string[]).includes(file.type)) return void toast.error('Only JPG, PNG or WebP images are allowed');
    if (file.size > IMAGE_UPLOAD.MAX_BYTES) return void toast.error(`Image must be under ${Math.round(IMAGE_UPLOAD.MAX_BYTES / 1048576)} MB`);
    avatar.upload.mutate(file);
  };

  if (!user) return null;
  const photo = assetUrl(user.avatarUrl);
  const checks = passwordChecks(next);
  const strength = checks.filter((c) => c.ok).length;
  const matches = confirm.length > 0 && confirm === next;
  const busyPhoto = avatar.upload.isPending || avatar.remove.isPending;

  const info = [
    { icon: Building2, label: 'Branch access', value: user.isCompanyWide ? 'All branches' : 'Own branch only' },
    { icon: Clock, label: 'Last login', value: formatDateTime(user.lastLoginAt) },
  ];
  const pe = profileErrors.errors;

  return (
    <>
      <PageHeader title="My Profile" description="Your photo, account details and password." />

      <div className="space-y-6">
        {/* Identity banner */}
        <Card className="overflow-hidden">
          <div className="relative h-28 bg-gradient-to-r from-[#04245C] via-brand-blue to-[#1C79D8]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute bottom-[-30px] right-24 h-24 w-24 rounded-full bg-white/10" />
          </div>
          <div className="flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end sm:gap-5">
            <div className="relative -mt-14 w-fit shrink-0">
              <Avatar src={photo} fallback={initials(user.name)} className="h-24 w-24 text-2xl ring-4 ring-white shadow-md" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busyPhoto}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white shadow ring-2 ring-white transition hover:bg-brand-blue-700 disabled:opacity-60"
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_UPLOAD.ACCEPT}
                className="hidden"
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="min-w-0 flex-1 sm:pb-2">
              <h2 className="truncate font-display text-2xl font-bold leading-tight text-brand-navy">{user.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {user.roles.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand-blue-700 ring-1 ring-brand-blue-100">
                    <ShieldCheck className="h-3.5 w-3.5" /> {humanize(r)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:pb-2">
              <Button size="sm" variant="outline" loading={avatar.upload.isPending} onClick={() => fileInput.current?.click()}>
                <Camera /> {photo ? 'Change photo' : 'Add photo'}
              </Button>
              {photo && (
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-50" loading={avatar.remove.isPending} onClick={() => avatar.remove.mutate()}>
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Account details — editable */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <h3 className="font-display text-base font-bold text-brand-navy">Account details</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Your name and the details you sign in with. Sign in using your email or username.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={pe.name} htmlFor="me-name">
                <IconInput id="me-name" icon={User} placeholder={PLACEHOLDERS.FULL_NAME} value={profile.name} maxLength={LIMITS.NAME_MAX} invalid={!!pe.name} onChange={(v) => setField('name', v)} />
              </Field>
              <Field label="Mobile" required error={pe.mobile} htmlFor="me-mobile">
                <IconInput id="me-mobile" icon={Phone} placeholder={PLACEHOLDERS.MOBILE} value={profile.mobile} inputMode="numeric" maxLength={10} invalid={!!pe.mobile} onChange={(v) => setField('mobile', v.replace(/\D/g, ''))} />
              </Field>
              <Field label="Email" error={pe.email} htmlFor="me-email">
                <IconInput id="me-email" icon={Mail} placeholder={PLACEHOLDERS.EMAIL} type="email" value={profile.email} maxLength={LIMITS.EMAIL_MAX} invalid={!!pe.email} onChange={(v) => setField('email', v)} />
              </Field>
              <Field label="Username" error={pe.username} hint="Optional — e.g. ravi.k" htmlFor="me-username">
                <IconInput id="me-username" icon={AtSign} placeholder={PLACEHOLDERS.USERNAME} value={profile.username} maxLength={LIMITS.USERNAME_MAX} invalid={!!pe.username} onChange={(v) => setField('username', v.toLowerCase())} />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {info.map((d) => (
                <div key={d.label} className="flex items-center gap-3 rounded-xl border bg-slate-50/60 px-4 py-2.5">
                  <d.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{d.label}</span>
                  <span className="ml-auto truncate text-sm font-semibold text-brand-navy">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {dirty && <span className="mr-auto text-xs font-medium text-amber-600">You have unsaved changes</span>}
            <Button variant="outline" disabled={!dirty || saveProfile.isPending} onClick={() => { setProfile(initial); profileErrors.reset(); }}>
              <RotateCcw /> Reset
            </Button>
            <Button disabled={!dirty} loading={saveProfile.isPending} onClick={submitProfile}>
              <Save /> Save changes
            </Button>
          </div>
        </Card>

        {/* Password */}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <KeyRound className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-brand-navy">Change password</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">You stay signed in here; all other devices are signed out.</p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {/* Lets the browser's password manager pair with this form instead of the profile fields above. */}
            <input type="text" name="username" autoComplete="username" value={user.username || user.email || user.mobile} readOnly hidden />
            <Field label="Current password" required error={errors.current} htmlFor="pw-current">
              <PasswordInput id="pw-current" placeholder={PLACEHOLDERS.CURRENT_PASSWORD} autoComplete="current-password" show={show} onToggle={() => setShow((s) => !s)} value={current} onChange={(v) => { setCurrent(v); clear('current'); }} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" required error={errors.next} htmlFor="pw-next">
                <PasswordInput id="pw-next" placeholder={PLACEHOLDERS.NEW_PASSWORD} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} value={next} onChange={(v) => { setNext(v); clear('next'); }} />
              </Field>
              <Field label="Confirm new password" required error={errors.confirm} htmlFor="pw-confirm">
                <PasswordInput id="pw-confirm" placeholder={PLACEHOLDERS.CONFIRM_PASSWORD} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} value={confirm} onChange={(v) => { setConfirm(v); clear('confirm'); }} />
              </Field>
            </div>

            {/* Live strength + rules */}
            <div className="rounded-xl border bg-slate-50/60 p-4">
              <div className="flex gap-1.5">
                {checks.map((_, i) => (
                  <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < strength ? (strength === checks.length ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-200')} />
                ))}
              </div>
              <ul className="mt-3 grid gap-1.5 text-[13px] sm:grid-cols-2">
                {[...checks, { label: 'Both new passwords match', ok: matches }].map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
                    <span className={c.ok ? 'text-slate-700' : 'text-muted-foreground'}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={change.isPending}>
                <KeyRound /> Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

/** Text input with a leading icon. Browser autofill is off so saved logins never overwrite profile fields. */
const IconInput = ({ id, icon: Icon, value, onChange, invalid, type = 'text', inputMode, maxLength, placeholder }: { id: string; icon: React.ComponentType<{ className?: string }>; value: string; onChange: (v: string) => void; invalid?: boolean; type?: string; inputMode?: 'numeric'; maxLength?: number; placeholder?: string }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input id={id} name={`profile-${id}`} type={type} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} value={value} aria-invalid={invalid} autoComplete="off" data-lpignore="true" data-1p-ignore onChange={(e) => onChange(e.target.value)} className="pl-9" />
  </div>
);

/** Password field with a show/hide eye (shared toggle across the form). */
const PasswordInput = ({ id, value, onChange, show, onToggle, autoComplete, placeholder }: { id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; autoComplete: string; placeholder?: string }) => (
  <div className="relative">
    <Input id={id} revealToggle={false} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
    <button type="button" onClick={onToggle} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-brand-navy" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);
