/**
 * Customer ledger: pick a customer, view the running-balance statement, post adjustments.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, PlusCircle } from 'lucide-react';
import { useCustomer, useCustomerSearch } from '@/hooks/usePeople';
import { usePaymentActions } from '@/hooks/useFinance';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import type { Customer } from '@/types';
import { EmptyState, Field, PageHeader } from '@/components/common';
import { useFormErrors } from '@/hooks/useFormErrors';
import { ledgerAdjustmentSchema } from '@/lib/validation';
import { CustomerPicker } from '@/components/Pickers';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';
import { LedgerTab } from './CustomerDetailPage';

export default function LedgerPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const customerId = params.get('customerId') ? Number(params.get('customerId')) : undefined;
  const preset = useCustomer(customerId);
  const [search, setSearch] = useState('');
  const results = useCustomerSearch(search);
  const [selected, setSelected] = useState<Customer | null>(null);
  const customer = selected ?? preset.data ?? null;
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

  const pick = (c: Customer) => {
    setSelected(c);
    setParams({ customerId: String(c.id) }, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Customer Ledger"
        description="Append-only statement. Corrections are posted as adjustments — history is never edited or deleted."
        breadcrumbs={[{ label: 'Finance', to: ROUTES.INVOICES }, { label: 'Customer Ledger' }]}
        actions={customer && can('ledger.create') && <Button variant="outline" onClick={() => setOpen(true)}><PlusCircle /> Post adjustment</Button>}
      />
      <Card className="mb-6 p-4">
        <div className="max-w-xl">
          <CustomerPicker value={customer} options={results.data ?? []} loading={results.isFetching} search={search} onSearchChange={setSearch} onSelect={pick} />
        </div>
      </Card>
      {customer ? <LedgerTab customerId={customer.id} /> : <Card><EmptyState icon={BookOpen} title="Select a customer" description="Search by name, mobile or customer ID to view their ledger." /></Card>}

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
              <Input id="ledger-description" value={adj.description} maxLength={500} onChange={(e) => { setAdj({ ...adj, description: e.target.value }); clear('description'); }} />
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
