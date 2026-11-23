/**
 * Manual invoice: customer, branch, free-form lines, GST options and live totals.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useInvoiceActions, useInvoicePreview } from '@/hooks/useFinance';
import { useCustomerSearch } from '@/hooks/usePeople';
import { useBranches, useServiceLookup } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import type { Customer } from '@/types';
import { Field, PageHeader, SectionCard } from '@/components/common';
import { CustomerPicker } from '@/components/Pickers';
import { InvoiceOptions, TotalsSummary, type InvoiceOptionsValue } from '@/components/FinanceWidgets';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';

interface Line {
  key: number;
  serviceId: number | null;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
}

let seq = 1;
const blank = (): Line => ({ key: seq++, serviceId: null, description: '', quantity: 1, rate: 0, gstRate: 18 });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const results = useCustomerSearch(search);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [branchId, setBranchId] = useState<number | ''>('');
  const { data: branches } = useBranches({ activeOnly: true });
  const { data: services } = useServiceLookup();
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [opts, setOpts] = useState<InvoiceOptionsValue>({ applyGst: true, isInterState: false, discount: 0, isFreeService: false, notes: '' });
  const actions = useInvoiceActions();

  const validLines = lines.filter((l) => l.description.trim().length >= 2 && l.quantity >= 1 && l.rate >= 0);
  const body = useMemo(() => ({ lines: validLines.map(({ key: _k, ...l }) => ({ ...l, discount: 0 })), ...opts }), [validLines, opts]);
  const preview = useInvoicePreview(body, validLines.length > 0);
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const canSubmit = !!customer && !!branchId && validLines.length === lines.length && lines.length > 0;

  return (
    <>
      <PageHeader title="Manual Invoice" description="For walk-in jobs, spare parts or adjustments not linked to a booking." breadcrumbs={[{ label: 'Finance', to: ROUTES.INVOICES }, { label: 'Manual Invoice' }]} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Bill to">
            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <Field label="Customer" required>
                <CustomerPicker value={customer} options={results.data ?? []} loading={results.isFetching} search={search} onSearchChange={setSearch} onSelect={(c) => { setCustomer(c); if (c.branchId) setBranchId(c.branchId); }} />
              </Field>
              <Field label="Branch" required>
                <NativeSelect value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select branch</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
          </SectionCard>
          <SectionCard title="Line items" actions={<Button size="sm" variant="soft" onClick={() => setLines((l) => [...l, blank()])}><Plus /> Add line</Button>}>
            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.key} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1.4fr_2fr_80px_120px_90px_40px] md:items-end">
                  <Field label="Service (optional)">
                    <NativeSelect value={l.serviceId ?? ''} onChange={(e) => { const s = services?.find((x) => x.id === Number(e.target.value)); update(l.key, s ? { serviceId: s.id, description: s.name, rate: s.effectivePrice, gstRate: s.gstApplicable ? s.gstRate : 0 } : { serviceId: null }); }}>
                      <option value="">Custom item</option>
                      {services?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Description" required><Input value={l.description} maxLength={500} onChange={(e) => update(l.key, { description: e.target.value })} /></Field>
                  <Field label="Qty"><Input type="number" min={1} value={l.quantity} onChange={(e) => update(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                  <Field label="Rate (₹)"><Input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => update(l.key, { rate: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="GST %">
                    <NativeSelect value={l.gstRate} onChange={(e) => update(l.key, { gstRate: Number(e.target.value) })}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</NativeSelect>
                  </Field>
                  <Button variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="text-red-500" /></Button>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Options"><InvoiceOptions value={opts} onChange={setOpts} /></SectionCard>
        </div>
        <Card className="p-5 xl:sticky xl:top-36 xl:self-start">
          <p className="mb-4 font-display text-[15px] font-bold">Totals</p>
          <TotalsSummary totals={preview.data} applyGst={opts.applyGst} isInterState={opts.isInterState} />
          <Button className="mt-6 w-full" size="lg" disabled={!canSubmit} loading={actions.createManual.isPending} onClick={() => actions.createManual.mutate({ customerId: customer!.id, branchId, ...body, notes: opts.notes || null }, { onSuccess: (inv) => navigate(ROUTES.INVOICE_DETAIL(inv.id)) })}>
            Create invoice
          </Button>
          {!canSubmit && <p className="mt-2 text-center text-xs text-muted-foreground">Select customer, branch and complete every line.</p>}
        </Card>
      </div>
    </>
  );
}
