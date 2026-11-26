/**
 * Company settings groups (company, general, GST, payment, reminders, notifications,
 * WhatsApp, email, working hours, customer app home) with integration status.
 */

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, CircleAlert, KeyRound, Save } from 'lucide-react';
import { useIntegration, useIntegrationActions, useRazorpayKeyActions, useRazorpayKeys, useSaveSettings, useSaveSettingsBatch, useSettings } from '@/hooks/useEngagement';
import { IntegrationKeysDialog } from '@/components/IntegrationKeysDialog';
import type { IntegrationName } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useFormErrors } from '@/hooks/useFormErrors';
import { settingsSchemas } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { LIMITS, PLACEHOLDERS, SETTING_SECTIONS, WEEKDAYS } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { ErrorState, Field, LoadingBlock, PageHeader, SectionCard } from '@/components/common';
import { Button, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/primitives';
import { TrackerStepsEditor, type TrackerStepValue } from '@/components/TrackerStepsEditor';
import { AppContentEditor, type AppContentValue } from '@/components/AppContentEditor';
import { PaymentMethodsEditor, RazorpayKeysDialog, type PaymentMethodValues } from '@/components/PaymentMethods';

type FieldType = 'text' | 'number' | 'bool' | 'textarea' | 'time' | 'days' | 'trackerSteps' | 'appContent' | 'paymentMethods' | { options: Array<{ value: string; label: string }> };
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
    { key: 'name', label: 'Company name', placeholder: PLACEHOLDERS.COMPANY_NAME, type: 'text', required: true, maxLength: LIMITS.NAME_MAX },
    { key: 'legalName', label: 'Legal name', placeholder: PLACEHOLDERS.LEGAL_NAME, type: 'text', maxLength: 150 },
    { key: 'tagline', label: 'Tagline', placeholder: PLACEHOLDERS.TAGLINE, type: 'text', maxLength: 150 },
    { key: 'gstin', label: 'GSTIN', type: 'text', maxLength: 15, placeholder: '22AAAAA0000A1Z5' },
    { key: 'stateCode', label: 'GST state code', placeholder: PLACEHOLDERS.GST_STATE_CODE, type: 'text', hint: 'e.g. 22 for Chhattisgarh', maxLength: 2 },
    { key: 'phone', label: 'Phone', type: 'text', input: 'tel', maxLength: MOBILE_MAX, placeholder: '10-digit mobile' },
    { key: 'email', label: 'Email', placeholder: PLACEHOLDERS.EMAIL, type: 'text', input: 'email', maxLength: LIMITS.EMAIL_MAX },
    { key: 'website', label: 'Website', type: 'text', input: 'url', maxLength: 200, placeholder: 'https://' },
    { key: 'supportPhone', label: 'Support phone', placeholder: PLACEHOLDERS.MOBILE, type: 'text', input: 'tel', maxLength: MOBILE_MAX },
    { key: 'supportWhatsapp', label: 'Support WhatsApp', placeholder: PLACEHOLDERS.MOBILE, type: 'text', input: 'tel', maxLength: MOBILE_MAX },
    { key: 'address', label: 'Registered address', placeholder: PLACEHOLDERS.ADDRESS, type: 'textarea', maxLength: LIMITS.ADDRESS_MAX },
  ],
  general: [
    { key: 'allowCustomerCancellationHours', label: 'Customer can cancel up to (hours before)', placeholder: PLACEHOLDERS.HOURS, type: 'number', required: true, hint: '0 to 168 hours' },
    { key: 'requireCompletionOtp', label: 'Require customer OTP to complete a job', type: 'bool' },
    { key: 'technicianCanReject', label: 'Technicians may reject assignments', type: 'bool' },
    { key: 'showTechnicianPhoneToCustomer', label: 'Show technician phone to customer', type: 'bool' },
    { key: 'timezone', label: 'Timezone', placeholder: PLACEHOLDERS.TIMEZONE, type: 'text', required: true, maxLength: 64 },
  ],
  gst: [
    { key: 'enabled', label: 'GST enabled', type: 'bool', hint: 'Turns off GST on all new invoices when disabled' },
    { key: 'defaultRate', label: 'Default GST rate (%)', type: { options: ['0', '5', '12', '18', '28'].map((v) => ({ value: v, label: `${v}%` })) } },
    { key: 'sacCode', label: 'SAC code for services', placeholder: PLACEHOLDERS.SAC_CODE, type: 'text', maxLength: 8 },
  ],
  payment: [
    { key: 'policy', label: 'Payment policy', type: { options: [{ value: 'PAY_AFTER_SERVICE', label: 'Pay after service (confirm immediately)' }, { value: 'PREPAID_REQUIRED', label: 'Prepaid — confirm after verified payment' }] } },
    { key: '_methods', label: 'Payment methods in the app', type: 'paymentMethods' },
  ],
  reminder: [
    { key: 'enabled', label: 'Service reminders enabled', type: 'bool' },
    { key: 'defaultIntervalMonths', label: 'Default interval (months)', placeholder: PLACEHOLDERS.MONTHS, type: 'number', required: true, hint: '1 to 36' },
    { key: 'daysBeforeDue', label: 'Notify customers (days before due)', placeholder: PLACEHOLDERS.DAYS, type: 'number', required: true, hint: '0 to 60' },
    { key: 'amcExpiryNoticeDays', label: 'AMC expiry notice (days)', placeholder: PLACEHOLDERS.DAYS, type: 'number', required: true, hint: '0 to 180' },
  ],
  notification: [
    { key: 'inApp', label: 'In-app notifications', type: 'bool' },
    { key: 'push', label: 'Push notifications (FCM)', type: 'bool' },
    { key: 'email', label: 'Email notifications', type: 'bool' },
    { key: 'whatsapp', label: 'WhatsApp Cloud notifications', type: 'bool', hint: 'Only after Meta verification and template approval' },
  ],
  whatsapp: [
    { key: 'manualSharingEnabled', label: 'Manual wa.me sharing', type: 'bool' },
    { key: 'businessNumber', label: 'Business WhatsApp number', placeholder: PLACEHOLDERS.MOBILE, type: 'text', input: 'tel', maxLength: MOBILE_MAX },
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
    { key: 'slotDurationMinutes', label: 'Slot length (minutes)', placeholder: PLACEHOLDERS.MINUTES, type: 'number', required: true, hint: '30 to 480' },
    { key: 'maxJobsPerSlot', label: 'Max jobs per slot', placeholder: PLACEHOLDERS.CAPACITY, type: 'number', required: true, hint: '1 to 100' },
  ],
  appHome: [{ key: '_appContent', label: 'App content', type: 'appContent' }],
  bookingTracker: [{ key: 'steps', label: 'Tracker steps', type: 'trackerSteps' }],
};

const INTEGRATION_FOR: Record<string, Array<{ key: string; label: string }>> = {
  notification: [{ key: 'fcm', label: 'Firebase (FCM)' }, { key: 'smtp', label: 'SMTP email' }, { key: 'whatsappCloud', label: 'WhatsApp Cloud API' }],
};

/** Sections shown (and saved) inside another section's page. Their old URLs redirect there. */
const MERGED_INTO: Record<string, string> = { email: 'notification', whatsapp: 'notification' };
const EXTRA_SECTIONS: Record<string, Array<{ key: string; title: string; description: string }>> = {
  notification: [
    { key: 'email', title: 'Email — what to send', description: 'Which messages go out by email when the Email channel is on.' },
    { key: 'whatsapp', title: 'WhatsApp', description: 'Manual wa.me sharing works without any setup; the Cloud API sends automatically once configured.' },
  ],
};

export default function SettingsPage() {
  const key = useParams().key ?? 'company';
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useSettings();
  const razorpay = useRazorpayKeys();
  const razorpayActions = useRazorpayKeyActions();
  const [keysOpen, setKeysOpen] = useState(false);
  const keyErrors = useFormErrors();
  const [integrationOpen, setIntegrationOpen] = useState<IntegrationName | null>(null);
  const integration = useIntegration(integrationOpen);
  const integrationActions = useIntegrationActions();
  const integrationErrors = useFormErrors();
  const save = useSaveSettings();
  const saveBatch = useSaveSettingsBatch();
  const [extraValues, setExtraValues] = useState<Record<string, Record<string, unknown>>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const { errors, validate, clear, fromServer, reset } = useFormErrors();
  const section = SETTING_SECTIONS[key];
  const fields = FIELDS[key] ?? [];
  const editable = can('settings.manage');

  useEffect(() => {
    if (data?.[key]) setValues({ ...(data[key] as Record<string, unknown>) });
    setExtraValues(Object.fromEntries((EXTRA_SECTIONS[key] ?? []).map((x) => [x.key, { ...((data?.[x.key] as Record<string, unknown>) ?? {}) }])));
    reset();
  }, [data, key, reset]);

  if (MERGED_INTO[key]) return <Navigate to={ROUTES.SETTINGS(MERGED_INTO[key])} replace />;

  if (!section) return <ErrorState message="Unknown settings section." />;
  if (isLoading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const set = (k: string, v: unknown) => {
    setValues((s) => ({ ...s, [k]: v }));
    clear(k);
  };
  const onSave = () => {
    const parsed = validate(settingsSchemas[key] ?? z.record(z.unknown()), values);
    if (!parsed) return;
    const extras = EXTRA_SECTIONS[key] ?? [];
    if (!extras.length) {
      save.mutate({ key, value: parsed as Record<string, unknown> }, { onError: (e) => fromServer(e) });
      return;
    }
    const items = [{ key, value: parsed as Record<string, unknown> }];
    for (const x of extras) {
      const res = (settingsSchemas[x.key] ?? z.record(z.unknown())).safeParse(extraValues[x.key] ?? {});
      if (!res.success) return toast.error(`${x.title}: ${res.error.issues[0]?.message ?? 'check the values'}`);
      items.push({ key: x.key, value: res.data as Record<string, unknown> });
    }
    saveBatch.mutate(items, { onError: (e) => fromServer(e) });
  };
  const setExtra = (section: string, k: string, v: unknown) => setExtraValues((s) => ({ ...s, [section]: { ...s[section], [k]: v } }));
  const hasSidePanel = !!INTEGRATION_FOR[key];
  const integrations = data?.integrations ?? {};

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        breadcrumbs={[{ label: 'Settings', to: ROUTES.SETTINGS_HOME }, { label: section.title }]}
        actions={editable && <Button loading={save.isPending || saveBatch.isPending} onClick={onSave}><Save /> Save changes</Button>}
      />
      <div className={cn('grid gap-6', hasSidePanel && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="min-w-0 space-y-6">
          <SectionCard title={section.title}>
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map((f) => {
                const v = values[f.key];
                if (f.type === 'appContent')
                  return !Array.isArray(values.slides) ? (
                    <LoadingBlock key={f.key} rows={4} />
                  ) : (
                    <div key={f.key} className="sm:col-span-2">
                      <AppContentEditor
                        value={values as unknown as AppContentValue}
                        disabled={!editable}
                        errors={errors}
                        onChange={(next, editedKey) => {
                          setValues({ ...(next as unknown as Record<string, unknown>) });
                          clear(editedKey);
                        }}
                      />
                    </div>
                  );
                if (f.type === 'paymentMethods')
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <Label className="mb-2 block">{f.label}</Label>
                      <PaymentMethodsEditor
                        value={values as unknown as PaymentMethodValues}
                        disabled={!editable}
                        errors={errors}
                        razorpay={razorpay.data}
                        razorpayLoading={razorpay.isLoading}
                        onChange={(patchValue) => Object.entries(patchValue).forEach(([k, val]) => set(k, val))}
                        onConfigureRazorpay={() => {
                          keyErrors.reset();
                          setKeysOpen(true);
                        }}
                      />
                    </div>
                  );
                if (f.type === 'trackerSteps')
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <TrackerStepsEditor
                        value={(v as TrackerStepValue[] | undefined) ?? []}
                        disabled={!editable}
                        errors={errors}
                        onChange={(steps, editedKey) => {
                          set(f.key, steps);
                          clear(editedKey);
                        }}
                      />
                    </div>
                  );
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
                      <Textarea id={`setting-${f.key}`} value={String(v ?? '')} disabled={!editable} maxLength={f.maxLength ?? LIMITS.NOTES_MAX} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
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
          {(EXTRA_SECTIONS[key] ?? []).map((x) => (
            <SectionCard key={x.key} title={x.title} description={x.description}>
              <div className="grid gap-5 sm:grid-cols-2">
                {(FIELDS[x.key] ?? []).map((f) => {
                  const v = extraValues[x.key]?.[f.key];
                  if (f.type === 'bool')
                    return (
                      <div key={f.key} className={cn('flex items-center justify-between gap-3 rounded-xl border bg-slate-50/50 px-4 py-3 transition-colors sm:col-span-2', v ? 'border-brand-blue-100 bg-brand-blue-50/30' : 'border-border')}>
                        <div>
                          <Label>{f.label}</Label>
                          {f.hint && <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>}
                        </div>
                        <Switch checked={!!v} disabled={!editable} onCheckedChange={(c) => setExtra(x.key, f.key, c)} aria-label={f.label} />
                      </div>
                    );
                  return (
                    <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`setting-${x.key}-${f.key}`}>
                      <Input
                        id={`setting-${x.key}-${f.key}`}
                        inputMode={f.input === 'tel' ? 'numeric' : undefined}
                        maxLength={f.maxLength}
                        placeholder={f.placeholder}
                        value={String(v ?? '')}
                        disabled={!editable}
                        onChange={(e) => setExtra(x.key, f.key, f.input === 'tel' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                      />
                    </Field>
                  );
                })}
              </div>
            </SectionCard>
          ))}
        </div>
        {INTEGRATION_FOR[key] && (
          <SectionCard title="Integrations" description="Configure each service here. Passwords and keys are encrypted on the server — never shown in the browser or apps.">
            <ul className="space-y-2.5">
              {INTEGRATION_FOR[key].map((i) => (
                <li key={i.key} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-[13.5px]">
                  {integrations[i.key] ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-green-600" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-500" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.label}</span>
                    <span className={cn('block text-xs', integrations[i.key] ? 'text-brand-green-700' : 'text-amber-600')}>{integrations[i.key] ? 'Configured' : 'Not configured'}</span>
                  </span>
                  {editable && (
                    <Button
                      type="button"
                      size="sm"
                      variant={integrations[i.key] ? 'outline' : 'default'}
                      onClick={() => {
                        integrationErrors.reset();
                        setIntegrationOpen(i.key as IntegrationName);
                      }}
                    >
                      <KeyRound /> {integrations[i.key] ? 'Manage' : 'Configure'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
      <IntegrationKeysDialog
        name={integrationOpen}
        onOpenChange={(o) => !o && setIntegrationOpen(null)}
        status={integration.data}
        saving={integrationActions.save.isPending}
        testing={integrationActions.test.isPending}
        removing={integrationActions.clear.isPending}
        errors={integrationErrors.errors}
        onSave={(body) => {
          if (!integrationOpen) return;
          integrationErrors.reset();
          integrationActions.save.mutate({ name: integrationOpen, body }, { onSuccess: () => setIntegrationOpen(null), onError: (e) => integrationErrors.fromServer(e) });
        }}
        onTest={(body) => {
          if (!integrationOpen) return;
          integrationErrors.reset();
          integrationActions.test.mutate({ name: integrationOpen, body }, { onError: (e) => integrationErrors.fromServer(e) });
        }}
        onRemove={() => integrationOpen && integrationActions.clear.mutate(integrationOpen, { onSuccess: () => setIntegrationOpen(null) })}
      />
      {key === 'payment' && (
        <RazorpayKeysDialog
          open={keysOpen}
          onOpenChange={setKeysOpen}
          status={razorpay.data}
          saving={razorpayActions.save.isPending}
          testing={razorpayActions.test.isPending}
          removing={razorpayActions.clear.isPending}
          errors={keyErrors.errors}
          onSave={(body) => {
            keyErrors.reset();
            razorpayActions.save.mutate(body, { onSuccess: () => setKeysOpen(false), onError: (e) => keyErrors.fromServer(e) });
          }}
          onTest={(body) => {
            keyErrors.reset();
            razorpayActions.test.mutate(body, { onError: (e) => keyErrors.fromServer(e) });
          }}
          onRemove={() =>
            razorpayActions.clear.mutate(undefined, {
              onSuccess: () => {
                setKeysOpen(false);
                // Without keys the app can't show Razorpay — switch it off in the form too.
                if (values.razorpayEnabled) set('razorpayEnabled', false);
              },
            })
          }
        />
      )}
    </>
  );
}
