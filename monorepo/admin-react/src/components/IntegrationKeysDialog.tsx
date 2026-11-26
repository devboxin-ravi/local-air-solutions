/**
 * Credentials dialog for SMTP / FCM / WhatsApp Cloud, driven by INTEGRATION_FORMS.
 * Secrets are write-only: blank keeps the saved value. UI only — callbacks out.
 */

import * as React from 'react';
import { CircleAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { INTEGRATION_FORMS, PAYMENT_METHODS_UI } from '@/constants/ui';
import type { IntegrationName, IntegrationStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Field } from './common';
import { Button, Input, Switch, Textarea } from './ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/overlays';

type FormValues = Record<string, string | boolean>;

/** Column span on the dialog's 6-column grid (full width on phones). */
const SPAN: Record<2 | 3 | 4 | 6, string> = { 2: 'col-span-6 sm:col-span-2', 3: 'col-span-6 sm:col-span-3', 4: 'col-span-6 sm:col-span-4', 6: 'col-span-6' };

export function IntegrationKeysDialog({
  name,
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
  /** Integration being edited; null = closed. */
  name: IntegrationName | null;
  onOpenChange: (open: boolean) => void;
  status?: IntegrationStatus;
  saving?: boolean;
  testing?: boolean;
  removing?: boolean;
  errors: Record<string, string | undefined>;
  onSave: (body: Record<string, unknown>) => void;
  onTest: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const def = name ? INTEGRATION_FORMS[name] : null;
  const [form, setForm] = React.useState<FormValues>({});
  const [jsonText, setJsonText] = React.useState('');
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  // Prefill non-secret values from what is in effect; secrets always start empty.
  React.useEffect(() => {
    if (!def) return;
    const next: FormValues = {};
    for (const f of def.fields) {
      if (f.secret) next[f.key] = '';
      else if (f.type === 'switch' || f.type === 'choice') next[f.key] = Boolean(status?.values[f.key]);
      else next[f.key] = status?.values[f.key] !== undefined ? String(status.values[f.key]) : '';
    }
    setForm(next);
    setJsonText('');
    setJsonError(null);
  }, [def, status]);

  if (!def || !name) return null;
  const set = (k: string, v: string | boolean) => setForm((s) => ({ ...s, [k]: v }));
  /** Typed values ready for the API: numbers as numbers, blanks dropped (blank secret = keep saved). */
  const body = () => {
    const out: Record<string, unknown> = {};
    for (const f of def.fields) {
      const v = form[f.key];
      if (f.type === 'switch' || f.type === 'choice') out[f.key] = v;
      else if (typeof v === 'string' && v.trim() !== '') out[f.key] = f.type === 'number' ? Number(v) : v.trim();
    }
    return out;
  };
  const importJson = (text: string) => {
    setJsonText(text);
    if (!text.trim() || !def.jsonImport) return setJsonError(null);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      Object.entries(def.jsonImport.map).forEach(([from, to]) => typeof parsed[from] === 'string' && set(to, parsed[from] as string));
      setJsonError(null);
    } catch {
      setJsonError('That is not valid JSON — paste the whole file.');
    }
  };
  const savedHere = status?.source === 'database';

  return (
    <Dialog open={!!name} onOpenChange={onOpenChange}>
      <DialogContent size="md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader title={def.title} description={def.description} />
        <DialogBody className="space-y-4">
          {status && !status.canStoreSecrets && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {PAYMENT_METHODS_UI.NO_ENCRYPTION_KEY}
            </p>
          )}
          {status?.source === 'env' && <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-muted-foreground">Currently using values from the server .env. Saving here overrides them.</p>}

          {def.jsonImport && (
            <Field label={def.jsonImport.label} hint={def.jsonImport.hint} error={jsonError ?? undefined}>
              <Textarea value={jsonText} onChange={(e) => importJson(e.target.value)} placeholder='{ "type": "service_account", "project_id": … }' className="min-h-[72px] font-mono text-xs" spellCheck={false} />
            </Field>
          )}

          <div className="grid grid-cols-6 gap-4">
            {def.fields.map((f) => {
              const span = SPAN[f.span ?? 3];
              const secretSaved = f.secret && status?.secretsSet[f.key];
              const hint = f.secret ? (secretSaved ? 'Saved — leave empty to keep it' : 'Encrypted, never shown again') : f.hint;
              if (f.type === 'choice')
                return (
                  <div key={f.key} className={span}>
                    <p className="mb-1.5 text-[13px] font-medium text-foreground">{f.label}</p>
                    <div role="radiogroup" aria-label={f.label} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                      {f.options?.map((o) => {
                        const active = form[f.key] === o.value;
                        return (
                          <button
                            key={String(o.value)}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              set(f.key, o.value);
                              Object.entries(o.patch ?? {}).forEach(([k, v]) => set(k, v));
                            }}
                            className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors', active ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-brand-navy')}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              if (f.type === 'switch')
                return (
                  <label key={f.key} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5', span)}>
                    <span className="text-[13.5px] font-medium text-brand-navy">{f.label}</span>
                    <Switch checked={Boolean(form[f.key])} onCheckedChange={(c) => set(f.key, c)} />
                  </label>
                );
              return (
                <Field key={f.key} label={f.label} required={f.required && !secretSaved} hint={hint} error={errors[f.key]} className={span}>
                  {f.type === 'textarea' ? (
                    <Textarea value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder={secretSaved ? '••••••••  (saved)' : f.placeholder} className="min-h-[96px] font-mono text-xs" spellCheck={false} />
                  ) : (
                    <Input
                      type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                      value={String(form[f.key] ?? '')}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={secretSaved ? '••••••••  (saved)' : f.placeholder}
                      autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                      spellCheck={false}
                      aria-invalid={!!errors[f.key]}
                    />
                  )}
                </Field>
              );
            })}
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" /> Passwords, keys and tokens are encrypted on the server and never shown again.
          </p>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <div>
            {savedHere && (
              <Button type="button" variant="ghost" className="text-destructive hover:bg-red-50" loading={removing} onClick={onRemove}>
                <Trash2 /> Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" loading={testing} onClick={() => onTest(body())}>
              Test connection
            </Button>
            <Button type="button" loading={saving} disabled={status ? !status.canStoreSecrets : false} onClick={() => onSave(body())}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
