/**
 * Customer ledger: list of all customers with their balance → click one to view the
 * running-balance statement and post adjustments.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, PlusCircle } from 'lucide-react';
import { useCustomer } from '@/hooks/usePeople';
import { useLedgerCustomers, usePaymentActions } from '@/hooks/useFinance';
import { useListState } from '@/hooks/useListState';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { cn, formatDate, formatMoney } from '@/lib/utils';
import type { LedgerCustomerRow } from '@/types';
import { Field, LoadingBlock, PageHeader } from '@/components/common';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ledgerAdjustmentSchema } from '@/lib/validation';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput } from '@/components/Filters';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';
import { LedgerTab } from './CustomerDetailPage';
import { PLACEHOLDERS } from '@/constants/ui';

export default function LedgerPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const customerId = params.get('customerId') ? Number(params.get('customerId')) : undefined;
  const preset = useCustomer(customerId);
  const customer = customerId ? preset.data ?? null : null;
  const list = useListState();
  const customers = useLedgerCustomers(list.query);
  const pay = usePaymentActions();
  const [open, setOpen] = useState(false);
  const [adj, setAdj] = useState({ entryType: 'ADJUSTMENT', direction: 'CREDIT', amount: '', description: '' });
  const { errors, validate, clear, fromServer, reset } = useFormErrors();
  const postEntry = () => {
    if (!customer) return;
    const parsed = validate(ledgerAdjustmentSchema, adj);
    if (!parsed) return;
    pay.adjust.mutate(
      { customerId: customer.id, entryType: adj.entryType, direction: adj.direction, amount: parsed.amount, description: parsed.description },
      {
        onSuccess: () => {
          setOpen(false);
          setAdj({ ...adj, amount: '', description: '' });
        },
        onError: (e) => fromServer(e),
      },
    );
  };

  const openLedger = (r: LedgerCustomerRow) => setParams({ customerId: String(r.customerId) });
  const backToList = () => setParams({});

  const columns: Column<LedgerCustomerRow>[] = [
    { key: 'customer', header: 'Customer', cell: (r) => <div><p className="font-semibold text-brand-navy">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.customerCode}</p></div> },
    { key: 'mobile', header: 'Mobile', cell: (r) => r.mobile },
    { key: 'branch', header: 'Branch', cell: (r) => r.branchName ?? <span className="text-muted-foreground">Not assigned</span> },
    { key: 'debit', header: 'Total billed', align: 'right', cell: (r) => <span className="num">{formatMoney(r.totalDebit)}</span> },
    { key: 'credit', header: 'Total paid', align: 'right', cell: (r) => <span className="num">{formatMoney(r.totalCredit)}</span> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (r) => <span className={cn('num font-bold', r.balance > 0 ? 'text-red-600' : r.balance < 0 ? 'text-emerald-600' : 'text-slate-500')}>{formatMoney(r.balance)}</span>,
    },
    { key: 'last', header: 'Last entry', cell: (r) => (r.lastEntry ? formatDate(r.lastEntry) : '—') },
    { key: 'go', header: '', align: 'right', cell: (r) => <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); openLedger(r); }}><BookOpen /> Ledger</Button> },
  ];

  return (
    <>
      <PageHeader
        title="Customer Ledger"
        description="Append-only statement. Corrections are posted as adjustments — history is never edited or deleted."
        breadcrumbs={[{ label: 'Finance', to: ROUTES.INVOICES }, { label: 'Customer Ledger' }]}
        actions={customer && can('ledger.create') && <Button variant="outline" onClick={() => setOpen(true)}><PlusCircle /> Post adjustment</Button>}
      />
      {customerId ? (
        <>
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
            {customer ? (
              <div>
                <p className="font-display text-lg font-bold text-brand-navy">{customer.fullName}</p>
                <p className="text-sm text-muted-foreground">{customer.customerCode} · {customer.mobile}</p>
              </div>
            ) : (
              <LoadingBlock rows={1} className="w-64" />
            )}
            <Button variant="outline" onClick={backToList}><ArrowLeft /> All customers</Button>
          </Card>
          <LedgerTab customerId={customerId} />
        </>
      ) : (
        <DataTable
          columns={columns}
          rows={customers.data?.items}
          rowKey={(r) => r.customerId}
          loading={customers.isLoading}
          error={customers.error ? (customers.error as Error).message : null}
          onRetry={customers.refetch}
          meta={customers.data?.meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          onRowClick={openLedger}
          emptyTitle="No customers found"
          emptyDescription="Try adjusting the search."
          toolbar={
            <FilterBar>
              <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Name, mobile, customer ID…" />
            </FilterBar>
          }
        />
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader title="Post ledger entry" description={customer ? `${customer.fullName} · ${customer.customerCode}` : undefined} />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Entry type">
              <NativeSelect value={adj.entryType} onChange={(e) => setAdj({ ...adj, entryType: e.target.value })}>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="OPENING_BALANCE">Opening balance</option>
              </NativeSelect>
            </Field>
            <Field label="Direction" hint="Debit increases what the customer owes">
              <NativeSelect value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value })}>
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </NativeSelect>
            </Field>
            <Field label="Amount (₹)" required error={errors.amount} htmlFor="ledger-amount">
              <Input id="ledger-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={adj.amount} onChange={(e) => { setAdj({ ...adj, amount: e.target.value }); clear('amount'); }} />
            </Field>
            <Field label="Description" required error={errors.description} htmlFor="ledger-description" className="sm:col-span-2">
              <Input id="ledger-description" placeholder={PLACEHOLDERS.LEDGER_DESCRIPTION} value={adj.description} maxLength={500} onChange={(e) => { setAdj({ ...adj, description: e.target.value }); clear('description'); }} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!customer} loading={pay.adjust.isPending} onClick={postEntry}>
              Post entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
