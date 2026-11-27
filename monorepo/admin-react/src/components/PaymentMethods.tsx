/**
 * Payment settings UI: one card per method the customer app can offer (UPI, Razorpay, Cash),
 * and the Razorpay keys dialog. UI only — values and status come in, changes go out via callbacks.
 */

import * as React from 'react';
import { Banknote, CheckCircle2, CircleAlert, CreditCard, KeyRound, Loader2, QrCode, ShieldCheck, Trash2 } from 'lucide-react';
import { PAYMENT_METHODS_UI, PLACEHOLDERS } from '@/constants/ui';
import { cn } from '@/lib/utils';
import type { RazorpayKeyInput, RazorpayKeyStatus } from '@/types';
import { Badge, Field } from './common';
import { Button, Input, Switch } from './ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/overlays';

export interface PaymentMethodValues {
  upiEnabled: boolean;
  upiId: string;
  upiPayeeName: string;
  razorpayEnabled: boolean;
  cashEnabled: boolean;
}

const MethodCard = ({
  icon,
  title,
  description,
  enabled,
  onToggle,
  disabled,
  toggleDisabled,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  disabled?: boolean;
  toggleDisabled?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className={cn('rounded-xl border bg-white transition-colors', enabled ? 'border-brand-blue-200 shadow-sm' : 'border-slate-200')}>
    <div className="flex items-start gap-3.5 p-4">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5', enabled ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-[15px] font-bold text-brand-navy">{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span className={cn('text-xs font-semibold', enabled ? 'text-brand-green-700' : 'text-slate-400')}>{enabled ? PAYMENT_METHODS_UI.SHOWN_IN_APP : PAYMENT_METHODS_UI.HIDDEN_IN_APP}</span>
        <Switch checked={enabled} disabled={disabled || toggleDisabled} onCheckedChange={onToggle} aria-label={title} />
      </div>
    </div>
    {children && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
  </div>
);

/** The three method cards. */
export function PaymentMethodsEditor({
  value,
  onChange,
  disabled,
  errors,
  razorpay,
  razorpayLoading,
  onConfigureRazorpay,
}: {
  value: PaymentMethodValues;
  onChange: (patch: Partial<PaymentMethodValues>) => void;
  disabled?: boolean;
  errors: Record<string, string | undefined>;
  razorpay?: RazorpayKeyStatus;
  razorpayLoading?: boolean;
  onConfigureRazorpay: () => void;
}) {
  const configured = !!razorpay?.configured;
  const noneOn = !value.upiEnabled && !value.razorpayEnabled && !value.cashEnabled;
  return (
    <div className="space-y-3">
      {noneOn && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          <CircleAlert className="h-4 w-4 shrink-0" /> {PAYMENT_METHODS_UI.NONE_ENABLED}
        </p>
      )}

      {/* UPI */}
      <MethodCard icon={<QrCode />} title="UPI" description={PAYMENT_METHODS_UI.UPI_DESCRIPTION} enabled={value.upiEnabled} onToggle={(on) => onChange({ upiEnabled: on })} disabled={disabled}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="UPI ID" required={value.upiEnabled} error={errors.upiId} hint="Shown to customers in the app">
            <Input value={value.upiId ?? ''} disabled={disabled} maxLength={100} placeholder="name@bank" onChange={(e) => onChange({ upiId: e.target.value })} aria-invalid={!!errors.upiId} />
          </Field>
          <Field label="Payee name" error={errors.upiPayeeName}>
            <Input value={value.upiPayeeName ?? ''} disabled={disabled} maxLength={100} placeholder={PLACEHOLDERS.UPI_PAYEE} onChange={(e) => onChange({ upiPayeeName: e.target.value })} />
          </Field>
        </div>
      </MethodCard>

      {/* Razorpay */}
      <MethodCard
        icon={<CreditCard />}
        title="Razorpay"
        description={PAYMENT_METHODS_UI.RAZORPAY_DESCRIPTION}
        enabled={value.razorpayEnabled}
        onToggle={(on) => onChange({ razorpayEnabled: on })}
        disabled={disabled}
        // Can't offer online payment without working keys — but can always switch it off.
        toggleDisabled={!configured && !value.razorpayEnabled}
        badge={
          razorpayLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : configured ? (
            <Badge tone={razorpay?.mode === 'live' ? 'green' : 'amber'}>{razorpay?.mode === 'live' ? 'Live keys' : 'Test keys'}</Badge>
          ) : (
            <Badge tone="neutral">Keys not set</Badge>
          )
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-[13px]">
            {configured ? (
              <p className="flex items-center gap-2 text-slate-600">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green-600" />
                Key ID <span className="font-mono font-semibold text-brand-navy">{razorpay?.keyId}</span>
                <span className="text-muted-foreground">· {razorpay?.source === 'env' ? 'from server .env' : 'saved here'}</span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-amber-700">
                <CircleAlert className="h-4 w-4 shrink-0" /> {PAYMENT_METHODS_UI.RAZORPAY_NEEDS_KEYS}
              </p>
            )}
            {value.razorpayEnabled && !configured && <p className="mt-1 text-xs text-destructive">{PAYMENT_METHODS_UI.RAZORPAY_ON_WITHOUT_KEYS}</p>}
          </div>
          <Button type="button" variant={configured ? 'outline' : 'default'} size="sm" disabled={disabled} onClick={onConfigureRazorpay}>
            <KeyRound /> {configured ? 'Manage keys' : 'Configure keys'}
          </Button>
        </div>
      </MethodCard>

      {/* Cash */}
      <MethodCard icon={<Banknote />} title="Cash / pay after service" description={PAYMENT_METHODS_UI.CASH_DESCRIPTION} enabled={value.cashEnabled} onToggle={(on) => onChange({ cashEnabled: on })} disabled={disabled} />
    </div>
  );
}

/** Enter / replace / test / remove Razorpay keys. Secrets are write-only: blank keeps the saved one. */
export function RazorpayKeysDialog({
  open,
  onOpenChange,
  status,
  saving,
  testing,
  removing,
  errors,
  onSave,
  onTest,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: RazorpayKeyStatus;
  saving?: boolean;
  testing?: boolean;
  removing?: boolean;
  errors: Record<string, string | undefined>;
  onSave: (body: RazorpayKeyInput) => void;
  onTest: (body: Partial<RazorpayKeyInput>) => void;
  onRemove: () => void;
}) {
  const [form, setForm] = React.useState<RazorpayKeyInput>({ keyId: '', keySecret: '', webhookSecret: '' });
  React.useEffect(() => {
    if (open) setForm({ keyId: status?.source === 'database' ? status.keyId ?? '' : '', keySecret: '', webhookSecret: '' });
  }, [open, status?.keyId, status?.source]);
  const savedHere = status?.source === 'database';
  const set = (k: keyof RazorpayKeyInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader title="Razorpay keys" description="Find them in Razorpay Dashboard → Account & Settings → API Keys." />
        <DialogBody className="space-y-4">
          {!status?.canStoreSecrets && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {PAYMENT_METHODS_UI.NO_ENCRYPTION_KEY}
            </p>
          )}
          <Field label="Key ID" required error={errors.keyId} hint="Starts with rzp_test_ (testing) or rzp_live_ (real payments)">
            <Input value={form.keyId} onChange={(e) => set('keyId', e.target.value.trim())} placeholder="rzp_test_xxxxxxxxxxxx" autoComplete="off" spellCheck={false} aria-invalid={!!errors.keyId} />
          </Field>
          <Field label="Key Secret" required={!savedHere} error={errors.keySecret} hint={savedHere ? 'Leave empty to keep the saved secret' : 'Stored encrypted — never shown again'}>
            <Input type="password" value={form.keySecret} onChange={(e) => set('keySecret', e.target.value.trim())} placeholder={savedHere ? '••••••••  (saved)' : 'Key Secret'} autoComplete="new-password" aria-invalid={!!errors.keySecret} />
          </Field>
          <Field label="Webhook secret" error={errors.webhookSecret} hint={status?.hasWebhookSecret ? 'Saved — leave empty to keep it' : 'Optional: confirms payments even if the app closes mid-payment'}>
            <Input type="password" value={form.webhookSecret} onChange={(e) => set('webhookSecret', e.target.value.trim())} placeholder={status?.hasWebhookSecret ? '••••••••  (saved)' : 'Webhook secret'} autoComplete="new-password" />
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" /> {PAYMENT_METHODS_UI.SECURITY_NOTE}
          </p>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <div>
            {savedHere && (
              <Button type="button" variant="ghost" className="text-destructive hover:bg-red-50" loading={removing} onClick={onRemove}>
                <Trash2 /> Remove keys
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" loading={testing} disabled={!form.keyId && !status?.configured} onClick={() => onTest({ keyId: form.keyId || undefined, keySecret: form.keySecret || undefined })}>
              Test connection
            </Button>
            <Button type="button" loading={saving} disabled={!status?.canStoreSecrets || !form.keyId} onClick={() => onSave(form)}>
              Save keys
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
