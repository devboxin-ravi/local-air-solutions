/**
 * Company settings groups (company, general, GST, payment, reminders, notifications,
 * WhatsApp, email, working hours, customer app home) with integration status.
 */

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Save } from 'lucide-react';
import { useSaveSettings, useSettings } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { useFormErrors } from '@/hooks/useFormErrors';
import { settingsSchemas } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { LIMITS, SETTING_SECTIONS, WEEKDAYS } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { ErrorState, Field, LoadingBlock, PageHeader, SectionCard } from '@/components/common';
import { Button, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/primitives';

type FieldType = 'text' | 'number' | 'bool' | 'textarea' | 'time' | 'days' | { options: Array<{ value: string; label: string }> };
interface SettingField {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  required?: boolean;
  /** HTML input flavour for text fields (keyboard + autofill). */
  input?: 'email' | 'tel' | 'url';
  maxLength?: number;
  placeholder?: string;
}

const MOBILE_MAX = 10;

const FIELDS: Record<string, SettingField[]> = {
  company: [
    { key: 'name', label: 'Company name', type: 'text', required: true, maxLength: LIMITS.NAME_MAX },
    { key: 'legalName', label: 'Legal name', type: 'text', maxLength: 150 },
    { key: 'tagline', label: 'Tagline', type: 'text', maxLength: 150 },
    { key: 'gstin', label: 'GSTIN', type: 'text', maxLength: 15, placeholder: '22AAAAA0000A1Z5' },
    { key: 'stateCode', label: 'GST state code', type: 'text', hint: 'e.g. 22 for Chhattisgarh', maxLength: 2 },
    { key: 'phone', label: 'Phone', type: 'text', input: 'tel', maxLength: MOBILE_MAX, placeholder: '10-digit mobile' },
    { key: 'email', label: 'Email', type: 'text', input: 'email', maxLength: LIMITS.EMAIL_MAX },
    { key: 'website', label: 'Website', type: 'text', input: 'url', maxLength: 200, placeholder: 'https://' },
    { key: 'supportPhone', label: 'Support phone', type: 'text', input: 'tel', maxLength: MOBILE_MAX },
    { key: 'supportWhatsapp', label: 'Support WhatsApp', type: 'text', input: 'tel', maxLength: MOBILE_MAX },
    { key: 'address', label: 'Registered address', type: 'textarea', maxLength: LIMITS.ADDRESS_MAX },
  ],
  general: [
    { key: 'allowCustomerCancellationHours', label: 'Customer can cancel up to (hours before)', type: 'number', required: true, hint: '0 to 168 hours' },
    { key: 'requireCompletionOtp', label: 'Require customer OTP to complete a job', type: 'bool' },
    { key: 'technicianCanReject', label: 'Technicians may reject assignments', type: 'bool' },
    { key: 'showTechnicianPhoneToCustomer', label: 'Show technician phone to customer', type: 'bool' },
    { key: 'timezone', label: 'Timezone', type: 'text', required: true, maxLength: 64 },
  ],
  gst: [
    { key: 'enabled', label: 'GST enabled', type: 'bool', hint: 'Turns off GST on all new invoices when disabled' },
    { key: 'defaultRate', label: 'Default GST rate (%)', type: { options: ['0', '5', '12', '18', '28'].map((v) => ({ value: v, label: `${v}%` })) } },
    { key: 'sacCode', label: 'SAC code for services', type: 'text', maxLength: 8 },
  ],
  payment: [
    { key: 'policy', label: 'Payment policy', type: { options: [{ value: 'PAY_AFTER_SERVICE', label: 'Pay after service (confirm immediately)' }, { value: 'PREPAID_REQUIRED', label: 'Prepaid — confirm after verified payment' }] } },
    { key: 'upiEnabled', label: 'Accept UPI (manual verification)', type: 'bool' },
    { key: 'upiId', label: 'UPI ID', type: 'text', hint: 'Shown to customers in the app', placeholder: 'name@bank', maxLength: 100 },
    { key: 'upiPayeeName', label: 'UPI payee name', type: 'text', maxLength: 100 },
    { key: 'cashEnabled', label: 'Accept cash', type: 'bool' },
    { key: 'razorpayEnabled', label: 'Enable Razorpay', type: 'bool', hint: 'Requires server keys — see integration status' },
  ],
  reminder: [
    { key: 'enabled', label: 'Service reminders enabled', type: 'bool' },
    { key: 'defaultIntervalMonths', label: 'Default interval (months)', type: 'number', required: true, hint: '1 to 36' },
    { key: 'daysBeforeDue', label: 'Notify customers (days before due)', type: 'number', required: true, hint: '0 to 60' },
    { key: 'amcExpiryNoticeDays', label: 'AMC expiry notice (days)', type: 'number', required: true, hint: '0 to 180' },
  ],
  notification: [
    { key: 'inApp', label: 'In-app notifications', type: 'bool' },
    { key: 'push', label: 'Push notifications (FCM)', type: 'bool' },
    { key: 'email', label: 'Email notifications', type: 'bool' },
    { key: 'whatsapp', label: 'WhatsApp Cloud notifications', type: 'bool', hint: 'Only after Meta verification and template approval' },
  ],
  whatsapp: [
    { key: 'manualSharingEnabled', label: 'Manual wa.me sharing', type: 'bool' },
    { key: 'businessNumber', label: 'Business WhatsApp number', type: 'text', input: 'tel', maxLength: MOBILE_MAX },
    { key: 'cloudApiEnabled', label: 'WhatsApp Business Cloud API', type: 'bool', hint: 'Stays inactive until credentials are configured on the server' },
  ],
  email: [
    { key: 'sendBookingUpdates', label: 'Booking updates', type: 'bool' },
    { key: 'sendInvoices', label: 'Invoices', type: 'bool' },
    { key: 'sendReminders', label: 'Service reminders', type: 'bool' },
  ],
  workingHours: [
    { key: 'workingDays', label: 'Working days', type: 'days', required: true },
    { key: 'startTime', label: 'Day starts', type: 'time', required: true },
    { key: 'endTime', label: 'Day ends', type: 'time', required: true },
    { key: 'slotDurationMinutes', label: 'Slot length (minutes)', type: 'number', required: true, hint: '30 to 480' },
    { key: 'maxJobsPerSlot', label: 'Max jobs per slot', type: 'number', required: true, hint: '1 to 100' },
  ],
  appHome: [
    { key: 'bannerEnabled', label: 'Show promo banner', type: 'bool', hint: 'The banner at the top of the customer app home screen' },
    { key: 'bannerTitle', label: 'Banner title', type: 'text', hint: 'e.g. Summer-ready AC', maxLength: 60 },
    { key: 'bannerButtonText', label: 'Banner button text', type: 'text', hint: 'Opens the services list', maxLength: 24 },
    { key: 'bannerSubtitle', label: 'Banner description', type: 'textarea', maxLength: 160 },
    { key: 'announcement', label: 'Announcement strip', type: 'textarea', hint: 'Optional one-line notice under the banner (e.g. holiday timings). Leave empty to hide.', maxLength: 160 },
  ],
};

const INTEGRATION_FOR: Record<string, Array<{ key: string; label: string }>> = {
  payment: [{ key: 'razorpay', label: 'Razorpay keys' }],
  notification: [{ key: 'fcm', label: 'Firebase (FCM)' }, { key: 'smtp', label: 'SMTP email' }, { key: 'whatsappCloud', label: 'WhatsApp Cloud API' }],
  whatsapp: [{ key: 'whatsappCloud', label: 'WhatsApp Cloud API credentials' }],
  email: [{ key: 'smtp', label: 'SMTP server' }],
};

export default function SettingsPage() {
  const key = useParams().key ?? 'company';
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useSettings();
  const save = useSaveSettings();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const { errors, validate, clear, fromServer, reset } = useFormErrors();
  const section = SETTING_SECTIONS[key];
  const fields = FIELDS[key] ?? [];
  const editable = can('settings.manage');

  useEffect(() => {
    if (data?.[key]) setValues({ ...(data[key] as Record<string, unknown>) });
    reset();
  }, [data, key, reset]);

  if (!section) return <ErrorState message="Unknown settings section." />;
  if (isLoading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const set = (k: string, v: unknown) => {
    setValues((s) => ({ ...s, [k]: v }));
    clear(k);
  };
  const onSave = () => {
    const parsed = validate(settingsSchemas[key] ?? z.record(z.unknown()), values);
    if (parsed) save.mutate({ key, value: parsed as Record<string, unknown> }, { onError: (e) => fromServer(e) });
  };
  const hasSidePanel = !!INTEGRATION_FOR[key];
  const integrations = data?.integrations ?? {};

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        breadcrumbs={[{ label: 'Settings', to: ROUTES.SETTINGS_HOME }, { label: section.title }]}
        actions={editable && <Button loading={save.isPending} onClick={onSave}><Save /> Save changes</Button>}
      />
      <div className={cn('grid gap-6', hasSidePanel && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
        <SectionCard title={section.title}>
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => {
              const v = values[f.key];
              if (f.type === 'bool')
                return (
                  <Field key={f.key} error={errors[f.key]} className="sm:col-span-2">
                    <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-slate-50/50 px-4 py-3 transition-colors', v ? 'border-brand-blue-100 bg-brand-blue-50/30' : 'border-border')}>
                      <div>
                        <Label>{f.label}</Label>
                        {f.hint && <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>}
                      </div>
                      <Switch checked={!!v} disabled={!editable} onCheckedChange={(c) => set(f.key, c)} aria-label={f.label} />
                    </div>
                  </Field>
                );
              if (f.type === 'days')
                return (
                  <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]} className="sm:col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d, i) => {
                        const days = (v as number[]) ?? [];
                        const on = days.includes(i);
                        return <button key={d} type="button" disabled={!editable} aria-pressed={on} onClick={() => set(f.key, on ? days.filter((x) => x !== i) : [...days, i].sort())} className={cn('h-9 w-12 rounded-lg border text-xs font-semibold transition-colors', on ? 'border-brand-blue bg-brand-blue text-white' : 'bg-white text-slate-600 hover:border-brand-blue-200')}>{d}</button>;
                      })}
                    </div>
                  </Field>
                );
              return (
                <Field key={f.key} label={f.label} hint={f.hint} required={f.required} error={errors[f.key]} htmlFor={`setting-${f.key}`} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}
                  counter={f.type === 'textarea' && f.maxLength ? { value: String(v ?? '').length, max: f.maxLength } : undefined}>
                  {f.type === 'textarea' ? (
                    <Textarea id={`setting-${f.key}`} value={String(v ?? '')} disabled={!editable} maxLength={f.maxLength ?? LIMITS.NOTES_MAX} onChange={(e) => set(f.key, e.target.value)} />
                  ) : typeof f.type === 'object' ? (
                    <NativeSelect id={`setting-${f.key}`} value={String(v ?? '')} disabled={!editable} onChange={(e) => set(f.key, key === 'gst' ? Number(e.target.value) : e.target.value)}>
                      {f.type.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  ) : (
                    <Input
                      id={`setting-${f.key}`}
                      type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : f.input ?? 'text'}
                      inputMode={f.input === 'tel' || f.type === 'number' ? 'numeric' : undefined}
                      maxLength={f.maxLength}
                      placeholder={f.placeholder}
                      value={String(v ?? '')}
                      disabled={!editable}
                      onChange={(e) => set(f.key, f.input === 'tel' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </SectionCard>
        {INTEGRATION_FOR[key] && (
          <SectionCard title="Integration status" description="Credentials live only in the server environment — never in the browser or apps.">
            <ul className="space-y-3">
              {INTEGRATION_FOR[key].map((i) => (
                <li key={i.key} className="flex items-center gap-3 text-[13.5px]">
                  {integrations[i.key] ? <CheckCircle2 className="h-5 w-5 text-brand-green-600" /> : <CircleAlert className="h-5 w-5 text-amber-500" />}
                  <span className="flex-1 font-medium">{i.label}</span>
                  <span className={integrations[i.key] ? 'text-brand-green-700' : 'text-amber-600'}>{integrations[i.key] ? 'Configured' : 'Not configured'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Set the variables in backend <code>.env</code> (see <code>.env.example</code>) and restart the API.</p>
          </SectionCard>
        )}
      </div>
    </>
  );
}
