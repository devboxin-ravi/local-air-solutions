/**
 * Chart components (Recharts) styled with brand tokens. UI only.
 */

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/constants/ui';
import { formatCompactMoney, formatMoney, formatNumber, humanize } from '@/lib/utils';
import { EmptyState } from './common';
import { BarChart3 } from 'lucide-react';

const axis = { stroke: '#94A3B8', fontSize: 11.5, tickLine: false, axisLine: false } as const;
const tooltipStyle = { borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,31,61,0.10)', fontSize: 12.5 };

const NoData = () => <EmptyState icon={BarChart3} title="No data for this period" description="Data appears as bookings and invoices are recorded." className="py-10" />;

export const RevenueChart = ({ data }: { data: Array<{ month: string; revenue: number; collected: number }> }) =>
  !data.length ? (
    <NoData />
  ) : data.length < 3 ? (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }} barGap={6}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} tickFormatter={formatCompactMoney} width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} cursor={{ fill: '#F1F5F9' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Billed" fill="#0048A8" radius={[6, 6, 0, 0]} maxBarSize={56} />
        <Bar dataKey="collected" name="Collected" fill="#88C040" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0048A8" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#0048A8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#88C040" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#88C040" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} tickFormatter={formatCompactMoney} width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue" name="Billed" stroke="#0048A8" strokeWidth={2.2} fill="url(#rev)" />
        <Area type="monotone" dataKey="collected" name="Collected" stroke="#6FA22F" strokeWidth={2.2} fill="url(#col)" />
      </AreaChart>
    </ResponsiveContainer>
  );

export const BookingTrendChart = ({ data }: { data: Array<{ period: string; total: number; completed: number; cancelled: number }> }) =>
  !data.length ? (
    <NoData />
  ) : (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: -18, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey="period" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F1F5F9' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" name="Total" fill="#0048A8" radius={[6, 6, 0, 0]} maxBarSize={40} />
        <Bar dataKey="completed" name="Completed" fill="#88C040" radius={[6, 6, 0, 0]} maxBarSize={40} />
        <Bar dataKey="cancelled" name="Cancelled" fill="#F87171" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );

export const DonutChart = ({ data, nameKey, valueKey, humanizeNames }: { data: Array<Record<string, string | number>>; nameKey: string; valueKey: string; humanizeNames?: boolean }) => {
  const total = data.reduce((s, d) => s + Number(d[valueKey]), 0);
  if (!total) return <NoData />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [formatNumber(v), humanizeNames ? humanize(n) : n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num font-display text-2xl font-extrabold text-brand-navy">{formatNumber(total)}</span>
          <span className="text-[11px] font-medium text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.slice(0, 8).map((d, i) => (
          <li key={String(d[nameKey])} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="flex-1 truncate text-slate-600">{humanizeNames ? humanize(String(d[nameKey])) : d[nameKey]}</span>
            <span className="num font-semibold text-brand-navy">{formatNumber(d[valueKey])}</span>
            <span className="num w-10 text-right text-xs text-muted-foreground">{Math.round((Number(d[valueKey]) / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const HorizontalBars = ({ data, labelKey, valueKey, money, secondaryKey, secondaryLabel }: { data: Array<Record<string, string | number>>; labelKey: string; valueKey: string; money?: boolean; secondaryKey?: string; secondaryLabel?: string }) => {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey])));
  if (!data.length) return <NoData />;
  return (
    <ul className="space-y-3.5">
      {data.map((d, i) => (
        <li key={`${d[labelKey]}-${i}`}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate font-medium text-brand-navy">{d[labelKey]}</span>
            <span className="num shrink-0 font-semibold text-slate-700">
              {money ? formatMoney(d[valueKey]) : formatNumber(d[valueKey])}
              {secondaryKey && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {formatNumber(d[secondaryKey])} {secondaryLabel}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-blue-400 transition-[width] duration-page" style={{ width: `${(Number(d[valueKey]) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
