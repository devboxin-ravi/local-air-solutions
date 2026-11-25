/**
 * Dashboard overview: KPIs, charts, recent activity and pending actions — all from the API.
 */

import { useMemo, useState, type ComponentProps } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clock,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChartPie,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  HardHat,
  History,
  IndianRupee,
  Layers,
  Plus,
  Receipt,
  ShieldAlert,
  Snowflake,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useDashboard, useDashboardCharts } from '@/hooks/useEngagement';
import { ROUTES } from '@/constants/routes';
import { DATE_FORMATS } from '@/constants/ui';
import { cn, formatDate, formatMoney, formatNumber, formatRelative, formatWith, initials, toYmd } from '@/lib/utils';
import { ErrorState, SectionCard, StatCard, StatusBadge } from '@/components/common';
import { BookingTrendChart, DonutChart, HorizontalBars, RevenueChart } from '@/components/Charts';
import { Button, Card } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { DateRange } from '@/components/Filters';
import type { DashboardData } from '@/types';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 180;
/** Delay between successive card entrance animations. */
const STAGGER_MS = 45;

const RANGE_PRESETS = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '12M', days: 365 },
];

const rangeForDays = (days: number) => ({ from: toYmd(new Date(Date.now() - days * DAY_MS)), to: toYmd(new Date()) });

/** Donut cards: centre the chart vertically so tall neighbours don't leave a gap below it. */
const DONUT_BODY = 'flex flex-1 items-center [&>*]:w-full';

type ActivityTab = 'bookings' | 'payments' | 'assignments';
const ACTIVITY_TABS: Array<{ value: ActivityTab; label: string }> = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'payments', label: 'Payments' },
  { value: 'assignments', label: 'Assignments' },
];

type AttentionTone = 'amber' | 'blue' | 'red';
const ATTENTION_TONES: Record<AttentionTone, { bar: string; icon: string; ping: string; text: string }> = {
  amber: { bar: 'bg-amber-400', icon: 'bg-amber-50 text-amber-600 ring-amber-100', ping: 'bg-amber-400', text: 'text-amber-700' },
  blue: { bar: 'bg-brand-blue-500', icon: 'bg-brand-blue-50 text-brand-blue ring-brand-blue-100', ping: 'bg-brand-blue-400', text: 'text-brand-blue' },
  red: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600 ring-rose-100', ping: 'bg-rose-400', text: 'text-rose-600' },
};

/** Avatar palette for activity rows, picked deterministically from the name. */
const AVATAR_TONES = [
  'bg-brand-blue-50 text-brand-blue-700 ring-brand-blue-100',
  'bg-brand-green-50 text-brand-green-700 ring-brand-green-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-cyan-50 text-cyan-700 ring-cyan-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
];
const avatarTone = (name: string) => AVATAR_TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { branchId } = useBranchScope();
  const navigate = useNavigate();
  const [presetDays, setPresetDays] = useState<number | null>(DEFAULT_RANGE_DAYS);
  const [range, setRange] = useState(() => rangeForDays(DEFAULT_RANGE_DAYS));
  const params = useMemo(() => ({ ...range, branchId }), [range, branchId]);
  const { data, isLoading, error, refetch } = useDashboard(params);
  const charts = useDashboardCharts(data, range);
  const [activityTab, setActivityTab] = useState<ActivityTab>('bookings');
  const k = data?.kpis;

  const quickActions = [
    { label: 'Create Booking', hint: 'New service request', icon: CalendarPlus, to: ROUTES.BOOKING_NEW, perm: 'bookings.create' },
    { label: 'Add Customer', icon: UserPlus, to: ROUTES.CUSTOMER_NEW, perm: 'customers.create' },
    { label: 'Add Service', icon: Wrench, to: ROUTES.SERVICE_NEW, perm: 'services.create' },
    { label: 'Assign Technician', icon: HardHat, to: ROUTES.ASSIGN, perm: 'assignments.assign' },
    { label: 'Generate Invoice', icon: FilePlus2, to: ROUTES.INVOICE_NEW, perm: 'invoices.create' },
  ].filter((a) => can(a.perm));
  const [primaryAction, ...otherActions] = quickActions;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const snapshot = k
    ? [
        { label: 'bookings today', value: k.todaysBookings, dot: 'bg-cyan-300' },
        { label: 'jobs in the field', value: k.activeJobs, dot: 'bg-brand-green-300' },
        { label: 'technicians active', value: k.activeTechnicians, dot: 'bg-violet-300' },
        ...(data && data.pendingActions.unassignedBookings > 0 ? [{ label: 'awaiting assignment', value: data.pendingActions.unassignedBookings, dot: 'bg-amber-300' }] : []),
      ]
    : [];

  const kpis: Array<ComponentProps<typeof StatCard>> = [
    { label: 'Total Bookings', value: formatNumber(k?.totalBookings), icon: ClipboardList, trend: k?.bookingsTrend, hint: k ? `${formatNumber(k.bookingsThisMonth)} this month` : undefined, to: ROUTES.BOOKINGS },
    { label: 'Today’s Bookings', value: formatNumber(k?.todaysBookings), icon: CalendarClock, tone: 'cyan', hint: 'Scheduled for today', to: ROUTES.BOOKING_CALENDAR },
    { label: 'Pending Jobs', value: formatNumber(k?.pendingJobs), icon: AlertCircle, tone: 'amber', hint: k ? `${formatNumber(k.activeJobs)} in the field` : undefined, to: ROUTES.BOOKINGS_VIEW('pending') },
    { label: 'Completed Jobs', value: formatNumber(k?.completedJobs), icon: CheckCircle2, tone: 'green', hint: 'Successfully closed', to: ROUTES.BOOKINGS_VIEW('completed') },
    { label: 'Active Technicians', value: formatNumber(k?.activeTechnicians), icon: HardHat, tone: 'violet', hint: 'Available team', to: ROUTES.TECH_AVAILABILITY },
    { label: 'Total Customers', value: formatNumber(k?.totalCustomers), icon: Users, hint: 'Registered customers', to: ROUTES.CUSTOMERS },
    { label: 'Monthly Revenue', value: formatMoney(k?.monthlyRevenue), icon: IndianRupee, tone: 'green', trend: k?.monthlyRevenueTrend, hint: k?.monthlyRevenueTrend !== null && k?.monthlyRevenueTrend !== undefined ? 'vs last month' : 'this month', to: ROUTES.INVOICES },
    { label: 'Outstanding Payments', value: formatMoney(k?.outstandingPayments), icon: Wallet, tone: 'red', hint: 'To be collected', to: ROUTES.OUTSTANDING },
  ];

  const attention: Array<{ n: number; label: string; cta: string; to: string; icon: LucideIcon; tone: AttentionTone }> = data
    ? [
        { n: data.pendingActions.unassignedBookings, label: 'bookings need a technician', cta: 'Assign now', to: ROUTES.ASSIGN, icon: HardHat, tone: 'amber' as const },
        { n: data.pendingActions.paymentVerifications, label: 'UPI payments to verify', cta: 'Verify payments', to: ROUTES.PAYMENT_VERIFICATION, icon: Receipt, tone: 'blue' as const },
        { n: data.pendingActions.expiringAmc, label: 'AMC contracts expiring', cta: 'Review AMC', to: ROUTES.AMC_EXPIRING, icon: ShieldAlert, tone: 'red' as const },
      ].filter((a) => a.n > 0)
    : [];

  const activityViewAll: Record<ActivityTab, string | undefined> = {
    bookings: ROUTES.BOOKINGS,
    payments: can('payments.view') ? ROUTES.PAYMENTS : undefined,
    assignments: ROUTES.ASSIGNMENTS,
  };
  const activityCounts: Record<ActivityTab, number> = {
    bookings: data?.lists.recentBookings.length ?? 0,
    payments: data?.lists.recentPayments.length ?? 0,
    assignments: data?.lists.recentAssignments.length ?? 0,
  };

  return (
    <div className="space-y-7">
      {/* Welcome hero */}
      <section className="relative isolate animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-blue-900 via-brand-blue-700 to-brand-blue-500 p-6 text-white shadow-elevated sm:p-8">
        <div className="hero-pattern pointer-events-none absolute inset-0 -z-10" />
        <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-green-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <Snowflake className="pointer-events-none absolute -bottom-10 right-[38%] -z-10 hidden h-44 w-44 animate-float text-white/[0.06] lg:block" strokeWidth={1.25} />

        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-blue-50 ring-1 ring-white/15 backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </span>
            <h1 className="mt-3 font-display text-[28px] font-extrabold leading-tight text-white sm:text-[34px]">
              {greeting},{' '}
              <span className="bg-gradient-to-r from-brand-green-200 via-brand-green-300 to-cyan-200 bg-clip-text text-transparent">{user?.name.split(' ')[0]}</span>{' '}
              👋
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-[14px] text-blue-100/90">
              <Wind className="h-4 w-4 text-brand-green-300" />
              Here’s what’s happening across your service operations.
            </p>

            {snapshot.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {snapshot.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-2.5 pr-3 text-[12.5px] text-blue-50 ring-1 ring-white/15 backdrop-blur">
                    <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                    <b className="num font-bold text-white">{formatNumber(s.value)}</b> {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {primaryAction && (
            <div className="w-full shrink-0 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-md lg:w-[430px]">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100/80">Quick actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={primaryAction.to}
                  className="group col-span-2 flex items-center gap-3 rounded-xl bg-white p-3 text-brand-navy shadow-lg shadow-brand-blue-900/20 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue-400 to-brand-blue-700 text-white">
                    <primaryAction.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{primaryAction.label}</span>
                    {primaryAction.hint && <span className="block text-[12px] text-muted-foreground">{primaryAction.hint}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 text-brand-blue transition-transform group-hover:translate-x-1" />
                </Link>
                {otherActions.map((a) => (
                  <Link
                    key={a.label}
                    to={a.to}
                    className="group flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-2.5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.16]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-brand-green-200 transition-colors group-hover:bg-brand-green-500 group-hover:text-white">
                      <a.icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-green-600">Overview</p>
          <h2 className="mt-0.5 text-xl font-extrabold">Performance overview</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {formatDate(range.from)} – {formatDate(range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-white p-1 shadow-card ring-1 ring-border/80" role="group" aria-label="Quick date range">
            {RANGE_PRESETS.map((p) => {
              const active = presetDays === p.days;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPresetDays(p.days);
                    setRange(rangeForDays(p.days));
                  }}
                  className={cn(
                    'rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-micro',
                    active ? 'bg-gradient-to-br from-brand-blue-500 to-brand-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-blue-50 hover:text-brand-blue',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <DateRange
            from={range.from}
            to={range.to}
            onChange={(from, to) => {
              setPresetDays(null);
              setRange({ from, to });
            }}
          />
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi, i) => (
              <div key={kpi.label} className="animate-fade-up" style={{ animationDelay: `${i * STAGGER_MS}ms` }}>
                <StatCard {...kpi} loading={isLoading} />
              </div>
            ))}
          </div>

          {/* Needs attention */}
          {attention.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                Needs your attention
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                {attention.map((a, i) => {
                  const t = ATTENTION_TONES[a.tone];
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => navigate(a.to)}
                      style={{ animationDelay: `${i * STAGGER_MS}ms` }}
                      className="group relative flex animate-fade-up items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-white py-3.5 pl-5 pr-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated"
                    >
                      <span className={cn('absolute inset-y-0 left-0 w-1', t.bar)} />
                      <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1', t.icon)}>
                        <a.icon className="h-5 w-5" />
                        <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full', t.ping)} />
                        <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', t.ping)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-slate-700">
                          <b className="num font-display text-[18px] font-extrabold text-brand-navy">{a.n}</b> {a.label}
                        </span>
                        <span className={cn('mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold', t.text)}>
                          {a.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard title="Monthly Revenue" description="Invoiced vs collected" icon={Activity} className="xl:col-span-2">
              {isLoading ? <div className="skeleton h-[280px]" /> : <RevenueChart data={charts.revenue} />}
            </SectionCard>
            <SectionCard title="Booking Status" description="Distribution for the selected period" icon={ChartPie} className="flex flex-col" bodyClassName={DONUT_BODY}>
              {isLoading ? <div className="skeleton h-[200px]" /> : <DonutChart data={(data?.charts.statusDistribution ?? []) as never} nameKey="status" valueKey="count" humanizeNames />}
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard title="Booking Trends" description="Created bookings by month" icon={CalendarDays} className="xl:col-span-2">
              {isLoading ? <div className="skeleton h-[280px]" /> : <BookingTrendChart data={charts.bookingTrend} />}
            </SectionCard>
            <SectionCard title="Service Categories" description="Bookings by category" icon={Layers} className="flex flex-col" bodyClassName={DONUT_BODY}>
              {isLoading ? <div className="skeleton h-[200px]" /> : <DonutChart data={(data?.charts.categoryDistribution ?? []) as never} nameKey="category" valueKey="bookings" />}
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {!branchId && user?.isCompanyWide && (
              <SectionCard title="Branch Performance" description="Billed revenue by branch" icon={Building2}>
                <HorizontalBars data={(data?.charts.branchPerformance ?? []) as never} labelKey="branch" valueKey="revenue" money secondaryKey="bookings" secondaryLabel="bookings" />
              </SectionCard>
            )}
            <SectionCard title="Technician Performance" description="Completed jobs in the selected period" icon={Trophy}>
              <HorizontalBars data={(data?.charts.technicianPerformance ?? []) as never} labelKey="name" valueKey="completed" secondaryKey="assigned" secondaryLabel="assigned" />
            </SectionCard>
          </div>

          {/* Activity */}
          <div className="grid gap-6 xl:grid-cols-5">
            <SectionCard
              title="Upcoming Appointments"
              description="Next scheduled visits"
              icon={CalendarClock}
              actions={<ViewAllButton label="Calendar" onClick={() => navigate(ROUTES.BOOKING_CALENDAR)} />}
              className="flex flex-col xl:col-span-2"
              bodyClassName="flex-1 p-0"
            >
              <UpcomingList loading={isLoading} bookings={data?.lists.upcoming ?? []} />
            </SectionCard>

            <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as ActivityTab)} className="xl:col-span-3">
              <SectionCard
                title="Recent Activity"
                description="Latest bookings, payments and assignments"
                icon={History}
                actions={activityViewAll[activityTab] ? <ViewAllButton onClick={() => navigate(activityViewAll[activityTab] as string)} /> : undefined}
                className="h-full"
                bodyClassName="p-0"
              >
                <TabsList className="px-3">
                  {ACTIVITY_TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="gap-2">
                      {t.label}
                      <span className="num rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-bold text-slate-500">{activityCounts[t.value]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="bookings" className="pt-0">
                  <ActivityList
                    empty="No bookings yet"
                    rows={(data?.lists.recentBookings ?? []).map((b) => ({
                      key: b.id,
                      to: ROUTES.BOOKING_DETAIL(b.id),
                      title: b.customer.fullName,
                      sub: `${b.items[0]?.serviceName ?? 'Repair request'} · ${b.bookingNumber}`,
                      right: formatMoney(b.estimatedTotal),
                      extra: formatDate(b.scheduledDate),
                      status: b.status,
                    }))}
                  />
                </TabsContent>
                <TabsContent value="payments" className="pt-0">
                  <ActivityList
                    empty="No payments yet"
                    rows={(data?.lists.recentPayments ?? []).map((p) => ({
                      key: p.id,
                      title: p.customer.fullName,
                      sub: `${p.paymentNumber} · ${p.method.replace('_', ' ')}`,
                      right: formatMoney(p.amount),
                      extra: formatRelative(p.createdAt),
                      status: p.status,
                    }))}
                  />
                </TabsContent>
                <TabsContent value="assignments" className="pt-0">
                  <ActivityList
                    empty="No assignments yet"
                    rows={(data?.lists.recentAssignments ?? []).map((a) => ({
                      key: a.id,
                      to: ROUTES.BOOKING_DETAIL(a.booking.id),
                      title: a.staff.user.name,
                      sub: a.booking.bookingNumber,
                      right: formatRelative(a.assignedAt),
                      status: a.status,
                    }))}
                  />
                </TabsContent>
              </SectionCard>
            </Tabs>
          </div>
        </>
      )}
      {can('bookings.create') && (
        <Link to={ROUTES.BOOKING_NEW} className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue-500 to-brand-blue-700 text-white shadow-elevated transition-transform hover:scale-105 lg:hidden" aria-label="New booking">
          <Plus className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}

const ViewAllButton = ({ label = 'View all', onClick }: { label?: string; onClick: () => void }) => (
  <Button variant="ghost" size="sm" onClick={onClick} className="group text-brand-blue hover:bg-brand-blue-50">
    {label} <ArrowUpRight className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </Button>
);

const ActivityList = ({ rows, empty }: { rows: Array<{ key: number; to?: string; title: string; sub: string; right: string; extra?: string; status: string }>; empty: string }) => {
  const navigate = useNavigate();
  if (!rows.length) return <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" disabled={!r.to} onClick={() => r.to && navigate(r.to)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors enabled:hover:bg-brand-blue-50/40">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ring-1', avatarTone(r.title))}>{initials(r.title)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-brand-navy group-enabled:group-hover:text-brand-blue">{r.title}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{r.sub}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-[13px] font-semibold text-slate-700">{r.right}</p>
              <div className="mt-1 flex items-center justify-end gap-2">
                {r.extra && <span className="text-[11.5px] text-muted-foreground">{r.extra}</span>}
                <StatusBadge status={r.status} />
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};

type UpcomingBooking = DashboardData['lists']['upcoming'][number];

/** Upcoming visits as a date-tile timeline (reads well with one row or many). */
const UpcomingList = ({ bookings, loading }: { bookings: UpcomingBooking[]; loading: boolean }) => {
  const navigate = useNavigate();
  if (loading) return <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)}</div>;
  if (!bookings.length) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue ring-1 ring-brand-blue-100">
          <CalendarClock className="h-5 w-5" />
        </span>
        <p className="text-[13.5px] font-semibold text-brand-navy">No upcoming appointments</p>
        <p className="text-[12.5px] text-muted-foreground">Scheduled visits will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1 p-3">
      {bookings.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => navigate(ROUTES.BOOKING_DETAIL(b.id))}
            className="group flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-colors hover:bg-brand-blue-50/50"
          >
            <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-brand-blue-50 to-white ring-1 ring-brand-blue-100">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-brand-blue">{formatWith(b.scheduledDate, DATE_FORMATS.MONTH_ABBR)}</span>
              <span className="num font-display text-[20px] font-extrabold leading-none text-brand-navy">{formatWith(b.scheduledDate, DATE_FORMATS.DAY_OF_MONTH)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-brand-navy group-hover:text-brand-blue">{b.customer.fullName}</span>
              <span className="block truncate text-[12.5px] text-muted-foreground">
                {b.items[0]?.serviceName ?? 'Repair request'} · {b.bookingNumber}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {b.scheduledTime ?? 'Any time'} · {formatWith(b.scheduledDate, DATE_FORMATS.WEEKDAY_SHORT)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <HardHat className="h-3 w-3" /> {b.assignments[0]?.staff.user.name ?? 'Unassigned'}
                </span>
              </span>
            </span>
            <StatusBadge status={b.status} />
          </button>
        </li>
      ))}
    </ul>
  );
};
