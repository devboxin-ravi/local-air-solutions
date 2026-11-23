/**
 * Generic report page: filters, chart, table and PDF/Excel/CSV export — data from the API only.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReport, useReportExport } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { ROUTES } from '@/constants/routes';
import { formatCompactMoney, formatMoney, formatNumber, humanize, toYmd } from '@/lib/utils';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, SectionCard } from '@/components/common';
import { DateRange } from '@/components/Filters';
import { Button, Card, NativeSelect } from '@/components/ui/primitives';

const DESCRIPTIONS: Record<string, string> = {
  bookings: 'Bookings created per period with completion and cancellation counts.',
  revenue: 'Monthly billed vs collected revenue.',
  services: 'Bookings and booked value by service.',
  staff: 'Technician assignments, completions and completion rate.',
  branches: 'Bookings, billing and collections per branch.',
  customers: 'Top customers by billed value.',
  gst: 'Monthly taxable value and GST breakup (CGST, SGST, IGST).',
  payments: 'Payments by method and status.',
  amc: 'AMC contracts and value by status.',
};

export default function ReportPage({ reportKey }: { reportKey?: string }) {
  const params = useParams();
  const key = reportKey ?? params.key ?? 'bookings';
  const { can } = useAuth();
  const { branchId } = useBranchScope();
  const [range, setRange] = useState({ from: toYmd(new Date(Date.now() - 365 * 86_400_000)), to: toYmd(new Date()) });
  const [granularity, setGranularity] = useState<'day' | 'month'>('month');
  const query = useMemo(() => ({ ...range, branchId, granularity }), [range, branchId, granularity]);
  const { data, isLoading, error, refetch } = useReport(key, query);
  const exportReport = useReportExport();

  const labelKey = data?.columns[0]?.key;
  const valueCol = data?.columns.find((c) => c.money) ?? data?.columns.find((c, i) => i > 0 && typeof data.rows[0]?.[c.key] === 'number');
  const chartData = (data?.rows ?? []).slice(0, 24);

  return (
    <>
      <PageHeader
        title={data?.title ?? `${humanize(key)} Report`}
        description={DESCRIPTIONS[key]}
        breadcrumbs={[{ label: 'Reports', to: ROUTES.REPORT('bookings') }, { label: data?.title ?? humanize(key) }]}
        actions={
          can('reports.export') && (
            <>
              <Button variant="outline" onClick={() => exportReport(key, 'pdf', query)}><FileText /> PDF</Button>
              <Button variant="outline" onClick={() => exportReport(key, 'xlsx', query)}><FileSpreadsheet /> Excel</Button>
              <Button variant="outline" onClick={() => exportReport(key, 'csv', query)}><FileDown /> CSV</Button>
            </>
          )
        }
      />
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
        {key === 'bookings' && (
          <NativeSelect value={granularity} onChange={(e) => setGranularity(e.target.value as 'day' | 'month')} className="sm:w-36" aria-label="Granularity">
            <option value="month">Monthly</option>
            <option value="day">Daily</option>
          </NativeSelect>
        )}
        <p className="text-xs text-muted-foreground sm:ml-auto">Branch filter follows the header selector.</p>
      </Card>
      {isLoading ? (
        <LoadingBlock rows={6} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !data?.rows.length ? (
        <Card><EmptyState title="No data for these filters" description="Try a wider date range or another branch." /></Card>
      ) : (
        <div className="space-y-6">
          {labelKey && valueCol && (
            <SectionCard title={valueCol.header} description={`by ${data.columns[0].header.toLowerCase()}`}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ left: -6, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey={labelKey} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (valueCol.money ? formatCompactMoney(v) : formatNumber(v))} width={64} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12.5 }} formatter={(v: number) => (valueCol.money ? formatMoney(v) : formatNumber(v))} cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey={valueCol.key} name={valueCol.header} fill="#0048A8" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
          <Card className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
                  {data.columns.map((c) => <th key={c.key} className={`px-4 py-3 ${c.money || typeof data.rows[0][c.key] === 'number' ? 'text-right' : 'text-left'}`}>{c.header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    {data.columns.map((c) => {
                      const v = r[c.key];
                      const numeric = c.money || typeof v === 'number';
                      return <td key={c.key} className={`px-4 py-3 ${numeric ? 'num text-right' : ''}`}>{c.money ? formatMoney(v) : typeof v === 'number' ? formatNumber(v) : humanize(String(v)) === String(v).toUpperCase() ? humanize(String(v)) : String(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
