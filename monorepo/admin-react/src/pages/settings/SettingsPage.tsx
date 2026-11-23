/**
 * Company settings groups (company, general, GST, payment, reminders, notifications,
 * WhatsApp, email, working hours, customer app home) with integration status.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Save } from 'lucide-react';
import { useSaveSettings, useSettings } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { SETTING_SECTIONS, WEEKDAYS } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { ErrorState, Field, LoadingBlock, PageHeader, SectionCard } from '@/components/common';
import { Button, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/primitives';

type FieldType = 'text' | 'number' | 'bool' | 'textarea' | 'time' | 'days' | { options: Array<{ value: string; label: string }> };
interface SettingField {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
}

const FIELDS: Record<string, SettingField[]> = {
  company: [
    { key: 'name', label: 'Company name', type: 'text' },
    { key: 'legalName', label: 'Legal name', type: 'text' },
    { key: 'tagline', label: 'Tagline', type: 'text' },
    { key: 'gstin', label: 'GSTIN', type: 'text' },
    { key: 'stateCode', label: 'GST state code', type: 'text', hint: 'e.g. 23 for Madhya Pradesh' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'website', label: 'Website', type: 'text' },
    { key: 'supportPhone', label: 'Support phone', type: 'text' },
    { key: 'supportWhatsapp', label: 'Support WhatsApp', type: 'text' },
    { key: 'address', label: 'Registered address', type: 'textarea' },
  ],
  general: [
    { key: 'allowCustomerCancellationHours', label: 'Customer can cancel up to (hours before)', type: 'number' },
    { key: 'requireCompletionOtp', label: 'Require customer OTP to complete a job', type: 'bool' },
    { key: 'technicianCanReject', label: 'Technicians may reject assignments', type: 'bool' },
    { key: 'showTechnicianPhoneToCustomer', label: 'Show technician phone to customer', type: 'bool' },
    { key: 'timezone', label: 'Timezone', type: 'text' },
  ],
  gst: [
    { key: 'enabled', label: 'GST enabled', type: 'bool', hint: 'Turns off GST on all new invoices when disabled' },
    { key: 'defaultRate', label: 'Default GST rate (%)', type: { options: ['0', '5', '12', '18', '28'].map((v) => ({ value: v, label: `${v}%` })) } },
    { key: 'sacCode', label: 'SAC code for services', type: 'text' },
  ],
  payment: [
    { key: 'policy', label: 'Payment policy', type: { options: [{ value: 'PAY_AFTER_SERVICE', label: 'Pay after service (confirm immediately)' }, { value: 'PREPAID_REQUIRED', label: 'Prepaid — confirm after verified payment' }] } },
    { key: 'upiEnabled', label: 'Accept UPI (manual verification)', type: 'bool' },
    { key: 'upiId', label: 'UPI ID', type: 'text', hint: 'Shown to customers in the app' },
    { key: 'upiPayeeName', label: 'UPI payee name', type: 'text' },
    { key: 'cashEnabled', label: 'Accept cash', type: 'bool' },
    { key: 'razorpayEnabled', label: 'Enable Razorpay', type: 'bool', hint: 'Requires server keys — see integration status' },
  ],
  reminder: [
    { key: 'enabled', label: 'Service reminders enabled', type: 'bool' },
    { key: 'defaultIntervalMonths', label: 'Default interval (months)', type: 'number' },
    { key: 'daysBeforeDue', label: 'Notify customers (days before due)', type: 'number' },
    { key: 'amcExpiryNoticeDays', label: 'AMC expiry notice (days)', type: 'number' },
  ],
  notification: [
    { key: 'inApp', label: 'In-app notifications', type: 'bool' },
    { key: 'push', label: 'Push notifications (FCM)', type: 'bool' },
    { key: 'email', label: 'Email notifications', type: 'bool' },
    { key: 'whatsapp', label: 'WhatsApp Cloud notifications', type: 'bool', hint: 'Only after Meta verification and template approval' },
  ],
  whatsapp: [
    { key: 'manualSharingEnabled', label: 'Manual wa.me sharing', type: 'bool' },
    { key: 'businessNumber', label: 'Business WhatsApp number', type: 'text' },
    { key: 'cloudApiEnabled', label: 'WhatsApp Business Cloud API', type: 'bool', hint: 'Stays inactive until credentials are configured on the server' },
  ],
  email: [
    { key: 'sendBookingUpdates', label: 'Booking updates', type: 'bool' },
    { key: 'sendInvoices', label: 'Invoices', type: 'bool' },
    { key: 'sendReminders', label: 'Service reminders', type: 'bool' },
  ],
  workingHours: [
    { key: 'workingDays', label: 'Working days', type: 'days' },
    { key: 'startTime', label: 'Day starts', type: 'time' },
    { key: 'endTime', label: 'Day ends', type: 'time' },
    { key: 'slotDurationMinutes', label: 'Slot length (minutes)', type: 'number' },
    { key: 'maxJobsPerSlot', label: 'Max jobs per slot', type: 'number' },
  ],
  appHome: [
    { key: 'bannerEnabled', label: 'Show promo banner', type: 'bool', hint: 'The banner at the top of the customer app home screen' },
    { key: 'bannerTitle', label: 'Banner title', type: 'text', hint: 'e.g. Summer-ready AC' },
    { key: 'bannerButtonText', label: 'Banner button text', type: 'text', hint: 'Opens the services list' },
    { key: 'bannerSubtitle', label: 'Banner description', type: 'textarea' },
    { key: 'announcement', label: 'Announcement strip', type: 'textarea', hint: 'Optional one-line notice under the banner (e.g. holiday timings). Leave empty to hide.' },
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
  const section = SETTING_SECTIONS[key];
  const fields = FIELDS[key] ?? [];
  const editable = can('settings.manage');

  useEffect(() => {
    if (data?.[key]) setValues({ ...(data[key] as Record<string, unknown>) });
  }, [data, key]);

  if (!section) return <ErrorState message="Unknown settings section." />;
  if (isLoading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  const integrations = data?.integrations ?? {};

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        breadcrumbs={[{ label: 'Settings', to: ROUTES.SETTINGS('company') }, { label: section.title }]}
        actions={editable && <Button loading={save.isPending} onClick={() => save.mutate({ key, value: values })}><Save /> Save changes</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SectionCard title={section.title}>
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => {
              const v = values[f.key];
              if (f.type === 'bool')
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 sm:col-span-2">
                    <div><Label>{f.label}</Label>{f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}</div>
                    <Switch checked={!!v} disabled={!editable} onCheckedChange={(c) => set(f.key, c)} aria-label={f.label} />
                  </div>
                );
              if (f.type === 'days')
                return (
                  <Field key={f.key} label={f.label} className="sm:col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d, i) => {
                        const days = (v as number[]) ?? [];
                        const on = days.includes(i);
                        return <button key={d} type="button" disabled={!editable} aria-pressed={on} onClick={() => set(f.key, on ? days.filter((x) => x !== i) : [...days, i].sort())} className={cn('h-9 w-12 rounded-lg border text-xs font-semibold', on ? 'border-brand-blue bg-brand-blue text-white' : 'bg-white text-slate-600')}>{d}</button>;
                      })}
                    </div>
                  </Field>
                );
              return (
                <Field key={f.key} label={f.label} hint={f.hint} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                  {f.type === 'textarea' ? (
                    <Textarea value={String(v ?? '')} disabled={!editable} maxLength={1000} onChange={(e) => set(f.key, e.target.value)} />
                  ) : typeof f.type === 'object' ? (
                    <NativeSelect value={String(v ?? '')} disabled={!editable} onChange={(e) => set(f.key, key === 'gst' ? Number(e.target.value) : e.target.value)}>
                      {f.type.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  ) : (
                    <Input type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'} value={String(v ?? '')} disabled={!editable} onChange={(e) => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)} />
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
