/**
 * Customer-app content editor: announcement, home promo banners (add / reorder / hide), home
 * sections, "Need a service today" card and the welcome (onboarding) screens. UI only —
 * props in, callbacks out.
 */

import { ArrowDown, ArrowUp, Megaphone, Plus, Sparkles, Smartphone, Trash2, LayoutList, Zap } from 'lucide-react';
import { APP_CONTENT } from '@/constants/ui';
import { cn } from '@/lib/utils';
import { Button, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/primitives';

export interface PromoSlideValue {
  enabled: boolean;
  tag: string;
  title: string;
  subtitle: string;
  buttonText: string;
  action: string;
  style: string;
}
export interface AppContentValue {
  announcement: string;
  slides: PromoSlideValue[];
  trustPoints: string[];
  todayCard: { enabled: boolean; title: string; subtitle: string; buttonText: string };
  showCategories: boolean;
  showPopular: boolean;
  showTrustPoints: boolean;
  onboarding: Array<{ title: string; text: string }>;
}

export interface AppContentEditorProps {
  value: AppContentValue;
  disabled?: boolean;
  /** Validation errors keyed by path, e.g. `slides.1.title`. */
  errors: Record<string, string | undefined>;
  onChange: (next: AppContentValue, editedKey: string) => void;
}

const NEW_SLIDE: PromoSlideValue = { enabled: true, tag: 'Offer', title: 'New banner', subtitle: '', buttonText: 'Book now', action: 'SERVICES', style: 'GREEN' };

export function AppContentEditor({ value: raw, disabled, errors, onChange }: AppContentEditorProps) {
  // Tolerate partially saved / older content: fill any missing part with an empty default.
  const value: AppContentValue = {
    ...raw,
    announcement: raw.announcement ?? '',
    slides: raw.slides ?? [],
    trustPoints: raw.trustPoints ?? ['', '', ''],
    todayCard: raw.todayCard ?? { enabled: true, title: '', subtitle: '', buttonText: '' },
    onboarding: raw.onboarding ?? Array.from({ length: APP_CONTENT.ONBOARDING_PAGES }, () => ({ title: '', text: '' })),
  };
  const set = <K extends keyof AppContentValue>(key: K, v: AppContentValue[K], edited: string = key) => onChange({ ...value, [key]: v }, edited);
  const setSlide = (i: number, patch: Partial<PromoSlideValue>) =>
    set('slides', value.slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)), `slides.${i}.${Object.keys(patch)[0]}`);
  const moveSlide = (i: number, dir: -1 | 1) => {
    const next = [...value.slides];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    set('slides', next);
  };

  return (
    <div className="space-y-6">
      {/* Announcement */}
      <Section icon={Megaphone} title="Announcement strip" description="One-line notice at the top of the home screen (e.g. holiday timings). Leave empty to hide.">
        <TextField label="Announcement" textarea value={value.announcement} max={APP_CONTENT.ANNOUNCEMENT_MAX} error={errors.announcement} disabled={disabled} onChange={(v) => set('announcement', v)} />
      </Section>

      {/* Promo banners */}
      <Section
        icon={Sparkles}
        title="Home banners"
        description={`Swipeable banners at the top of the home screen. Up to ${APP_CONTENT.MAX_SLIDES}; hidden ones are kept but not shown.`}
        action={
          <Button type="button" size="sm" variant="outline" disabled={disabled || value.slides.length >= APP_CONTENT.MAX_SLIDES} onClick={() => set('slides', [...value.slides, { ...NEW_SLIDE }])}>
            <Plus /> Add banner
          </Button>
        }
      >
        {!value.slides.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No banners — the home screen starts with the categories.</p>}
        <div className="space-y-4">
          {value.slides.map((s, i) => {
            const style = APP_CONTENT.STYLES.find((x) => x.value === s.style) ?? APP_CONTENT.STYLES[0];
            const err = (f: keyof PromoSlideValue) => errors[`slides.${i}.${f}`];
            return (
              <div key={i} className={cn('overflow-hidden rounded-xl border', !s.enabled && 'opacity-70')}>
                <div className="flex items-center gap-2 border-b bg-slate-50/70 px-4 py-2.5">
                  <span className="text-sm font-semibold text-brand-navy">Banner {i + 1}</span>
                  {!s.enabled && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Hidden</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <Label className="mr-1 text-xs text-muted-foreground">Show</Label>
                    <Switch checked={s.enabled} disabled={disabled} onCheckedChange={(c) => setSlide(i, { enabled: c })} aria-label={`Show banner ${i + 1}`} />
                    <IconBtn label="Move up" disabled={disabled || i === 0} onClick={() => moveSlide(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={disabled || i === value.slides.length - 1} onClick={() => moveSlide(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Delete banner" danger disabled={disabled} onClick={() => set('slides', value.slides.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>

                {/* Live preview */}
                <div className="p-4">
                  <div className="rounded-xl p-4" style={{ background: `linear-gradient(120deg, ${style.from}, ${style.to})` }}>
                    {s.tag && <span className="inline-block rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: style.accent }}>{s.tag}</span>}
                    <p className="mt-1.5 font-display text-lg font-bold leading-tight text-brand-navy">{s.title || 'Banner title'}</p>
                    {s.subtitle && <p className="mt-1 max-w-md text-xs text-slate-600">{s.subtitle}</p>}
                    <span className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: style.accent }}>{s.buttonText || 'Button'} →</span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TextField label="Small tag" value={s.tag} max={APP_CONTENT.TAG_MAX} error={err('tag')} disabled={disabled} placeholder="e.g. Featured Service" onChange={(v) => setSlide(i, { tag: v })} />
                    <TextField label="Title" required value={s.title} max={APP_CONTENT.TITLE_MAX} error={err('title')} disabled={disabled} onChange={(v) => setSlide(i, { title: v })} />
                    <div className="sm:col-span-2">
                      <TextField label="Description" textarea value={s.subtitle} max={APP_CONTENT.SUBTITLE_MAX} error={err('subtitle')} disabled={disabled} onChange={(v) => setSlide(i, { subtitle: v })} />
                    </div>
                    <TextField label="Button text" required value={s.buttonText} max={APP_CONTENT.BUTTON_MAX} error={err('buttonText')} disabled={disabled} onChange={(v) => setSlide(i, { buttonText: v })} />
                    <div className="space-y-1.5">
                      <Label>Button opens</Label>
                      <NativeSelect value={s.action} disabled={disabled} onChange={(e) => setSlide(i, { action: e.target.value })}>
                        {APP_CONTENT.ACTIONS.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Colour</Label>
                      <div className="flex flex-wrap gap-2">
                        {APP_CONTENT.STYLES.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => setSlide(i, { style: c.value })}
                            className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition', s.style === c.value ? 'border-brand-blue ring-1 ring-brand-blue' : 'hover:border-slate-300')}
                          >
                            <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.accent})` }} />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Home sections */}
      <Section icon={LayoutList} title="Home sections" description="Choose what appears on the home screen below the banners.">
        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleTile label="Categories" checked={value.showCategories} disabled={disabled} onChange={(c) => set('showCategories', c)} />
          <ToggleTile label="Popular services" checked={value.showPopular} disabled={disabled} onChange={(c) => set('showPopular', c)} />
          <ToggleTile label="Trust points" checked={value.showTrustPoints} disabled={disabled} onChange={(c) => set('showTrustPoints', c)} />
        </div>
        {value.showTrustPoints && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {value.trustPoints.map((p, i) => (
              <TextField
                key={i}
                label={`Trust point ${i + 1}`}
                required
                value={p}
                max={APP_CONTENT.TRUST_MAX}
                error={errors[`trustPoints.${i}`]}
                disabled={disabled}
                onChange={(v) => set('trustPoints', value.trustPoints.map((x, idx) => (idx === i ? v : x)), `trustPoints.${i}`)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Need a service today card */}
      <Section
        icon={Zap}
        title="“Need a service today?” card"
        description="Call-to-action card on the home screen that starts a booking."
        action={<Switch checked={value.todayCard.enabled} disabled={disabled} onCheckedChange={(c) => set('todayCard', { ...value.todayCard, enabled: c }, 'todayCard.enabled')} aria-label="Show card" />}
      >
        <div className={cn('grid gap-4 sm:grid-cols-2', !value.todayCard.enabled && 'pointer-events-none opacity-50')}>
          <TextField label="Title" required value={value.todayCard.title} max={APP_CONTENT.TITLE_MAX} error={errors['todayCard.title']} disabled={disabled} onChange={(v) => set('todayCard', { ...value.todayCard, title: v }, 'todayCard.title')} />
          <TextField label="Button text" required value={value.todayCard.buttonText} max={APP_CONTENT.BUTTON_MAX} error={errors['todayCard.buttonText']} disabled={disabled} onChange={(v) => set('todayCard', { ...value.todayCard, buttonText: v }, 'todayCard.buttonText')} />
          <div className="sm:col-span-2">
            <TextField label="Line under the title" value={value.todayCard.subtitle} max={APP_CONTENT.SUBTITLE_MAX} error={errors['todayCard.subtitle']} disabled={disabled} onChange={(v) => set('todayCard', { ...value.todayCard, subtitle: v }, 'todayCard.subtitle')} />
          </div>
        </div>
      </Section>

      {/* Onboarding */}
      <Section icon={Smartphone} title="Welcome screens" description="The three screens a customer sees the first time they open the app.">
        <div className="grid gap-4 lg:grid-cols-3">
          {value.onboarding.map((p, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-slate-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screen {i + 1}</p>
              <TextField
                label="Title"
                required
                value={p.title}
                max={APP_CONTENT.ONBOARDING_TITLE_MAX}
                error={errors[`onboarding.${i}.title`]}
                disabled={disabled}
                onChange={(v) => set('onboarding', value.onboarding.map((x, idx) => (idx === i ? { ...x, title: v } : x)), `onboarding.${i}.title`)}
              />
              <TextField
                label="Text"
                textarea
                value={p.text}
                max={APP_CONTENT.ONBOARDING_TEXT_MAX}
                error={errors[`onboarding.${i}.text`]}
                disabled={disabled}
                onChange={(v) => set('onboarding', value.onboarding.map((x, idx) => (idx === i ? { ...x, text: v } : x)), `onboarding.${i}.text`)}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Small building blocks ───
function Section({ icon: Icon, title, description, action, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-bold text-brand-navy">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, max, error, required, textarea, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; error?: string; required?: boolean; textarea?: boolean; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <span className="text-[11px] text-muted-foreground">{(value ?? '').length}/{max}</span>
      </div>
      {textarea ? (
        <Textarea value={value ?? ''} maxLength={max} disabled={disabled} placeholder={placeholder} aria-invalid={!!error} className="min-h-[64px]" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ''} maxLength={max} disabled={disabled} placeholder={placeholder} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleTile({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between rounded-xl border px-4 py-3 transition-colors', checked ? 'border-brand-blue-100 bg-brand-blue-50/40' : 'bg-white')}>
      <Label>{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white disabled:opacity-30', danger && 'hover:text-destructive')}
    >
      {children}
    </button>
  );
}
