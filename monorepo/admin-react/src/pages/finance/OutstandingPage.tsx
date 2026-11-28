/**
 * Outstanding payments: customers with a positive ledger balance + finance summary.
 */

import { useNavigate } from 'react-router-dom';
import { IndianRupee, Landmark, Receipt, Wallet } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useFinanceSummary, useOutstanding } from '@/hooks/useFinance';
import { ROUTES } from '@/constants/routes';
import { formatMoney, formatRelative } from '@/lib/utils';
import { PageHeader, StatCard } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/primitives';

type Row = { customerId: number; customerCode: string; fullName: string; mobile: string; balance: number; lastEntry: string };

export default function OutstandingPage() {
  const navigate = useNavigate();
  const list = useListState();
  const { data, isLoading, error, refetch } = useOutstanding(list.query);
  const summary = useFinanceSummary({ branchId: list.query.branchId });
  const s = summary.data;

  const columns: Column<Row>[] = [
    { key: 'customer', header: 'Customer', cell: (r) => <div><p className="font-semibold text-brand-navy">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.customerCode}</p></div> },
    { key: 'mobile', header: 'Mobile', cell: (r) => r.mobile },
    { key: 'last', header: 'Last activity', cell: (r) => formatRelative(r.lastEntry) },
    { key: 'balance', header: 'Outstanding', align: 'right', cell: (r) => <span className="num font-bold text-red-600">{formatMoney(r.balance)}</span> },
    { key: 'go', header: '', align: 'right', cell: (r) => <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); navigate(`${ROUTES.FINANCE_LEDGER}?customerId=${r.customerId}`); }}>Ledger</Button> },
  ];

  return (
    <>
      <PageHeader title="Outstanding Payments" description="Customers with unpaid balances, largest first." breadcrumbs={[{ label: 'Accounts', to: ROUTES.INVOICES }, { label: 'Outstanding' }]} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue (billed)" value={formatMoney(s?.totalRevenue)} icon={IndianRupee} loading={summary.isLoading} />
        <StatCard label="Payments received" value={formatMoney(s?.paymentsReceived)} icon={Landmark} tone="green" loading={summary.isLoading} hint="last 12 months" />
        <StatCard label="Pending on invoices" value={formatMoney(s?.pendingPayments)} icon={Receipt} tone="amber" loading={summary.isLoading} />
        <StatCard label="GST collected (period)" value={formatMoney(s?.gstSummary.total)} icon={Wallet} tone="violet" loading={summary.isLoading} />
      </div>
      <DataTable columns={columns} rows={data?.items} rowKey={(r) => r.customerId} loading={isLoading} error={error ? (error as Error).message : null} onRetry={refetch} meta={data?.meta} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} onRowClick={(r) => navigate(ROUTES.CUSTOMER_DETAIL(r.customerId))} emptyTitle="No outstanding balances" emptyDescription="Every customer is fully paid up." />
    </>
  );
}
