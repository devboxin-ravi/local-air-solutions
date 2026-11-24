/**
 * Shared presentational components: page header, badges, states, stat cards, form field,
 * confirm dialog, key-value list. UI only — props in, callbacks out.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowUpRight, ChevronRight, Inbox, RefreshCw, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn, humanize } from '@/lib/utils';
import { GENERIC_STATUS_TONE, type Tone } from '@/constants/ui';
import { Button, Card, Label, Textarea } from './ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/overlays';
import logoUrl from '@/assets/logo.png';
import logoHeader1x from '@/assets/logo-header.png';
import logoHeader2x from '@/assets/logo-header@2x.png';
import logoHeader3x from '@/assets/logo-header@3x.png';

// ─── Brand ───
/**
 * Original logo. `header` uses pre-rendered 1x/2x/3x renditions (sharp at small sizes);
 * `full` uses the full-resolution master for large placements.
 */
export const BrandLogo = ({ className, variant = 'full' }: { className?: string; variant?: 'header' | 'full' }) =>
  variant === 'header' ? (
    <img
      src={logoHeader1x}
      srcSet={`${logoHeader1x} 1x, ${logoHeader2x} 2x, ${logoHeader3x} 3x`}
      width={179}
      height={60}
      alt="Local Air Solutions"
      className={cn('h-[52px] w-auto select-none', className)}
      draggable={false}
      decoding="async"
    />
  ) : (
    <img src={logoUrl} alt="Local Air Solutions" className={cn('h-9 w-auto select-none', className)} draggable={false} decoding="async" />
  );

// ─── Page header with breadcrumb ───
export interface Crumb {
  label: string;
  to?: string;
}

export const PageHeader = ({ title, description, breadcrumbs, actions }: { title: string; description?: string; breadcrumbs?: Crumb[]; actions?: React.ReactNode }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
          {breadcrumbs.map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
              {c.to ? (
                <Link to={c.to} className="transition-colors hover:text-brand-blue">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-600">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <h1 className="truncate text-2xl font-extrabold sm:text-[26px]">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

// ─── Badges ───
const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-brand-blue-50 text-brand-blue-700 ring-brand-blue-100',
  green: 'bg-brand-green-50 text-brand-green-700 ring-brand-green-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
};

export const Badge = ({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', TONE_CLASSES[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
    {children}
  </span>
);

export const StatusBadge = ({ status, className }: { status?: string | null; className?: string }) =>
  status ? (
    <Badge tone={GENERIC_STATUS_TONE[status] ?? 'neutral'} dot className={className}>
      {humanize(status)}
    </Badge>
  ) : null;

export const ActiveBadge = ({ active }: { active: boolean }) => <Badge tone={active ? 'green' : 'neutral'} dot>{active ? 'Active' : 'Inactive'}</Badge>;

// ─── States ───
export const EmptyState = ({ title = 'Nothing here yet', description, icon: Icon = Inbox, action, className }: { title?: string; description?: string; icon?: LucideIcon; action?: React.ReactNode; className?: string }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue-50 to-brand-green-50 ring-1 ring-brand-blue-100">
      <Icon className="h-6 w-6 text-brand-blue" />
    </div>
    <p className="font-display text-[15px] font-bold text-brand-navy">{title}</p>
    {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
      <AlertTriangle className="h-5 w-5 text-red-600" />
    </div>
    <p className="font-semibold text-brand-navy">Couldn’t load this data</p>
    <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{message ?? 'Please try again.'}</p>
    {onRetry && (
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw /> Retry
      </Button>
    )}
  </div>
);

export const LoadingBlock = ({ rows = 4, className }: { rows?: number; className?: string }) => (
  <div className={cn('space-y-3 p-5', className)} aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton h-10" style={{ opacity: 1 - i * 0.12 }} />
    ))}
  </div>
);

// ─── Stat card ───
type StatTone = 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'red';

/** Full class strings per tone (Tailwind needs them literal): icon badge, corner glow, hover bar, link text. */
const STAT_TONES: Record<StatTone, { icon: string; glow: string; bar: string; text: string }> = {
  blue: { icon: 'from-brand-blue-400 to-brand-blue-700 shadow-brand-blue-500/30', glow: 'bg-brand-blue-200/50', bar: 'from-brand-blue-600 to-brand-blue-300', text: 'text-brand-blue' },
  green: { icon: 'from-brand-green-400 to-brand-green-700 shadow-brand-green-500/30', glow: 'bg-brand-green-200/60', bar: 'from-brand-green-600 to-brand-green-300', text: 'text-brand-green-700' },
  amber: { icon: 'from-amber-400 to-orange-500 shadow-amber-500/30', glow: 'bg-amber-200/60', bar: 'from-orange-500 to-amber-300', text: 'text-amber-600' },
  violet: { icon: 'from-violet-400 to-indigo-600 shadow-violet-500/30', glow: 'bg-violet-200/60', bar: 'from-indigo-600 to-violet-300', text: 'text-violet-600' },
  cyan: { icon: 'from-cyan-400 to-sky-600 shadow-cyan-500/30', glow: 'bg-cyan-200/60', bar: 'from-sky-600 to-cyan-300', text: 'text-cyan-700' },
  red: { icon: 'from-rose-400 to-red-600 shadow-red-500/30', glow: 'bg-rose-200/60', bar: 'from-red-600 to-rose-300', text: 'text-red-600' },
};

export const StatCard = ({
  label,
  value,
  icon: Icon,
  trend,
  hint,
  tone = 'blue',
  loading,
  to,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  trend?: number | null;
  hint?: string;
  tone?: StatTone;
  loading?: boolean;
  to?: string;
}) => {
  const t = STAT_TONES[tone];
  const body = (
    <Card
      className={cn(
        'group relative h-full min-h-[132px] overflow-hidden p-5 transition-all duration-200',
        to && 'hover:-translate-y-0.5 hover:border-transparent hover:shadow-elevated',
      )}
    >
      {/* Decorative tone glow + accent bar */}
      <div className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100', t.glow)} />
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', t.bar)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
          {loading ? <div className="skeleton mt-2.5 h-8 w-24" /> : <p className="num mt-2 truncate font-display text-[28px] font-extrabold leading-none text-brand-navy">{value}</p>}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ring-4 ring-white transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105', t.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {!loading && (trend !== undefined || hint || to) && (
        <div className="relative mt-4 flex items-center gap-2 text-xs">
          {trend !== undefined && trend !== null && (
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold', trend >= 0 ? 'bg-brand-green-50 text-brand-green-700' : 'bg-red-50 text-red-600')}>
              {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(trend)}%
            </span>
          )}
          {hint && <span className="truncate text-muted-foreground">{hint}</span>}
          {to && (
            <span className={cn('ml-auto inline-flex translate-x-1 items-center gap-0.5 font-semibold opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100', t.text)}>
              View <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      )}
    </Card>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
};

// ─── Single-card forms ───
/** One card holding a whole form; sections are separated by dividers, optional footer for actions. */
export const FormCard = ({ children, footer, className }: { children: React.ReactNode; footer?: React.ReactNode; className?: string }) => (
  <Card className={cn('overflow-hidden', className)}>
    <div className="divide-y divide-border/70">{children}</div>
    {footer && <div className="flex flex-col-reverse gap-2 border-t bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
  </Card>
);

/** A titled step inside a FormCard: heading on the left (desktop) or on top (mobile), fields beside it. */
export const FormSection = ({
  step,
  title,
  description,
  actions,
  children,
  className,
}: {
  step?: number;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={cn('grid gap-5 px-5 py-6 sm:px-6 xl:grid-cols-[230px_minmax(0,1fr)] xl:gap-10', className)}>
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-[12px] font-bold text-brand-blue ring-1 ring-brand-blue-100">{step}</span>
        )}
        <div className="min-w-0 pt-0.5">
          <h3 className="font-display text-[15px] font-bold leading-tight text-brand-navy">{title}</h3>
          {description && <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className={cn('mt-3 flex flex-wrap gap-2', step !== undefined && 'pl-10')}>{actions}</div>}
    </div>
    <div className="min-w-0">{children}</div>
  </section>
);

// ─── Form field wrapper ───
export const Field = ({
  label,
  error,
  hint,
  required,
  htmlFor,
  counter,
  className,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  counter?: { value: number; max: number };
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    data-invalid={error ? 'true' : undefined}
    className={cn(
      'space-y-1.5',
      // Invalid: red outline on whatever control sits inside (input, select, textarea, picker button).
      error && '[&_:is(input,select,textarea,button[aria-haspopup])]:border-red-400 [&_:is(input,select,textarea,button[aria-haspopup])]:bg-red-50/40 [&_:is(input,select,textarea)]:focus-visible:ring-red-200',
      className,
    )}
  >
    {(label || counter) && (
      <div className="flex items-center justify-between">
        {label && (
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </Label>
        )}
        {counter && <span className={cn('num text-[11px]', counter.value > counter.max ? 'text-red-600' : 'text-muted-foreground')}>{counter.value}/{counter.max}</span>}
      </div>
    )}
    {children}
    {error ? (
      <p role="alert" className="flex items-start gap-1.5 text-[12px] font-medium text-red-600">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    ) : hint ? (
      <p className="text-[12px] text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

// ─── Confirm dialog ───
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  requireReason,
  reasonLabel = 'Reason',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
}) => {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    if (!open) setReason('');
  }, [open]);
  const invalid = requireReason && reason.trim().length < 3;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={title} description={description} />
        {requireReason && (
          <DialogBody>
            <Field label={reasonLabel} required hint="At least 3 characters" counter={{ value: reason.length, max: 1000 }}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} autoFocus />
            </Field>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} loading={loading} disabled={invalid} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Key/value grid ───
export const KeyValue = ({ items, columns = 2 }: { items: Array<{ label: string; value: React.ReactNode }>; columns?: 1 | 2 | 3 }) => (
  <dl className={cn('grid gap-x-6 gap-y-4', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3')}>
    {items.map((it) => (
      <div key={it.label} className="min-w-0">
        <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{it.label}</dt>
        <dd className="mt-0.5 break-words text-[13.5px] font-medium text-brand-navy">{it.value ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

export const SectionCard = ({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Optional header icon shown in a soft brand badge. */
  icon?: LucideIcon;
}) => (
  <Card className={cn('overflow-hidden', className)}>
    <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue ring-1 ring-brand-blue-100">
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-brand-navy">{title}</h3>
          {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    <div className={cn('p-5', bodyClassName)}>{children}</div>
  </Card>
);
