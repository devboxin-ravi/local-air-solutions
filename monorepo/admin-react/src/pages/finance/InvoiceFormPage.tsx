/**
 * Invoice form, two uses:
 * - Manual invoice: customer, branch, free-form lines, GST options and live totals.
 * - For Invoice bill (/finance/for-invoice/:id): a completed job's bill to check, edit (e.g. remove GST)
 *   and approve into an invoice, or remove.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { useDraftInvoice, useDraftInvoiceActions, useInvoiceActions, useInvoicePreview } from '@/hooks/useFinance';
import { useCustomerSearch } from '@/hooks/usePeople';
import { useBranches, useServiceLookup } from '@/hooks/useApi';
import { stockInvoiceLine, useStockLookup } from '@/hooks/useStock';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { useFormErrors } from '@/hooks/useFormErrors';
import { useBranchScope } from '@/hooks/useBranchScope';
import { manualInvoiceSchema } from '@/lib/validation';
import type { Customer, Invoice } from '@/types';
import { ConfirmDialog, ErrorState, Field, FormCard, FormSection, LoadingBlock, PageHeader } from '@/components/common';
import { CustomerPicker, SearchSelect } from '@/components/Pickers';
import { formatMoney, toNumber } from '@/lib/utils';
import { InvoiceOptions, TotalsSummary, type InvoiceOptionsValue } from '@/components/FinanceWidgets';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';
import { FOR_INVOICE, PLACEHOLDERS } from '@/constants/ui';
import { useGoBack } from '@/hooks/useGoBack';

interface Line {
  key: number;
  serviceId: number | null;
  stockItemId: number | null;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
}

let seq = 1;
const blank = (): Line => ({
  key: seq++,
  serviceId: null,
  stockItemId: null,
  description: '',
  quantity: 1,
  rate: 0,
  gstRate: 18,
});

/** A saved bill back into form lines. Per-line discounts are folded into the invoice discount. */
const fromInvoice = (inv: Invoice): { lines: Line[]; opts: InvoiceOptionsValue } => ({
  lines: (inv.items ?? []).map((i) => ({ key: seq++, serviceId: i.serviceId, stockItemId: i.stockItemId, description: i.description, quantity: i.quantity, rate: toNumber(i.rate), gstRate: toNumber(i.gstRate) })),
  opts: { applyGst: inv.applyGst, isInterState: inv.isInterState, discount: inv.isFreeService ? 0 : toNumber(inv.discount), isFreeService: inv.isFreeService, notes: inv.notes ?? '' },
});

export default function InvoiceFormPage() {
  const draftId = Number(useParams().id) || undefined;
  const isDraft = !!draftId;
  const goBack = useGoBack(isDraft ? ROUTES.FOR_INVOICE : ROUTES.INVOICES);
  const navigate = useNavigate();
  const { can } = useAuth();
  const draft = useDraftInvoice(draftId);
  const draftActions = useDraftInvoiceActions();
  const canEdit = !isDraft || can('forInvoice.edit');
  const [search, setSearch] = useState('');
  const results = useCustomerSearch(search);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const { branchId: scopeBranchId } = useBranchScope();
  const [branchId, setBranchId] = useState<number | ''>(scopeBranchId ?? '');
  const { data: branches } = useBranches({ activeOnly: true });
  // Services offered in (and priced for) the invoice's branch.
  const { data: services } = useServiceLookup(branchId === '' ? undefined : branchId);
  const { data: stockItems } = useStockLookup(branchId === '' ? undefined : branchId);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [opts, setOpts] = useState<InvoiceOptionsValue>({
    applyGst: true,
    isInterState: false,
    discount: 0,
    isFreeService: false,
    notes: '',
  });
  const [confirm, setConfirm] = useState<'approve' | 'discard' | null>(null);
  const actions = useInvoiceActions();

  // Load the bill into the form once.
  const loaded = useRef<number | null>(null);
  useEffect(() => {
    if (!draft.data || loaded.current === draft.data.id) return;
    loaded.current = draft.data.id;
    const form = fromInvoice(draft.data);
    setBranchId(draft.data.branchId);
    if (form.lines.length) setLines(form.lines);
    setOpts(form.opts);
  }, [draft.data]);

  /** Stock belongs to a branch, so switching branch unlinks stock items already picked. */
  const changeBranch = (next: number | '') => {
    if (next === branchId) return;
    setBranchId(next);
    setLines((ls) => ls.map((l) => (l.stockItemId ? { ...blank(), key: l.key } : l)));
    clear('branchId');
  };

  const validLines = lines.filter((l) => l.description.trim().length >= 2 && l.quantity >= 1 && l.rate >= 0);
  const body = useMemo(
    () => ({
      lines: validLines.map(({ key: _k, ...l }) => ({ ...l, discount: 0 })),
      ...opts,
    }),
    [validLines, opts],
  );
  const preview = useInvoicePreview(body, validLines.length > 0);
  const { errors, validate, clear, fromServer } = useFormErrors();
  const update = (key: number, patch: Partial<Line>) => {
    const index = lines.findIndex((l) => l.key === key);
    Object.keys(patch).forEach((field) => clear(`lines.${index}.${field}`));
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const parse = () =>
    validate(manualInvoiceSchema, {
      customerId: isDraft ? draft.data?.customerId : customer?.id,
      branchId: branchId === '' ? undefined : branchId,
      lines,
    });

  const submit = () => {
    const parsed = parse();
    if (!parsed) return;
    actions.createManual.mutate(
      { customerId: parsed.customerId, branchId: parsed.branchId, ...body, notes: opts.notes || null },
      { onSuccess: (inv) => navigate(ROUTES.INVOICE_DETAIL(inv.id)), onError: (e) => fromServer(e) },
    );
  };

  /** Saves the edited bill; false when the form or the server refused it. */
  const saveDraft = async () => {
    if (!draftId || !parse()) return false;
    try {
      await draftActions.update.mutateAsync({ id: draftId, body: { ...body, notes: opts.notes || null } });
      return true;
    } catch (e) {
      fromServer(e);
      return false;
    }
  };

  const approve = async () => {
    if (!draftId) return;
    if (canEdit && !(await saveDraft())) {
      setConfirm(null);
      return;
    }
    draftActions.approve.mutate(draftId, { onSuccess: (inv) => navigate(ROUTES.INVOICE_DETAIL(inv.id)) });
  };

  const lineError = (i: number, field: string) => errors[`lines.${i}.${field}`];

  if (isDraft && draft.isLoading) return <LoadingBlock rows={8} />;
  if (isDraft && (draft.error || !draft.data)) return <ErrorState message={(draft.error as Error)?.message} onRetry={() => draft.refetch()} />;
  const bill = draft.data;

  return (
    <>
      <PageHeader onBack={goBack}
        title={bill ? `${FOR_INVOICE.TITLE} · ${bill.invoiceNumber}` : 'Manual Invoice'}
        description={bill ? `${bill.booking?.bookingNumber ?? ''} · ${bill.customer.fullName}. ${FOR_INVOICE.EDIT_HINT}` : 'For walk-in jobs, spare parts or adjustments not linked to a booking.'}
        breadcrumbs={[{ label: 'Accounts', to: ROUTES.INVOICES }, bill ? { label: FOR_INVOICE.TITLE, to: ROUTES.FOR_INVOICE } : { label: 'Manual Invoice' }, ...(bill ? [{ label: bill.invoiceNumber }] : [])]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <fieldset disabled={!canEdit} className="min-w-0">
          <FormCard>
            <FormSection step={1} title="Bill to" description="The customer being invoiced and the billing branch.">
              <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                <Field label="Customer" required error={errors.customerId}>
                  {bill ? (
                    <Input readOnly value={`${bill.customer.fullName} · ${bill.customer.customerCode} · ${bill.customer.mobile}`} />
                  ) : (
                    <CustomerPicker
                      value={customer}
                      options={results.data ?? []}
                      loading={results.isFetching}
                      search={search}
                      onSearchChange={setSearch}
                      onSelect={(c) => {
                        setCustomer(c);
                        clear('customerId');
                        if (c.branchId) changeBranch(c.branchId);
                      }}
                    />
                  )}
                </Field>
                <Field label="Branch" required error={errors.branchId} htmlFor="invoice-branch">
                  <NativeSelect searchable
                    id="invoice-branch"
                    value={branchId}
                    disabled={isDraft}
                    onChange={(e) => changeBranch(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select branch</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            </FormSection>
            <FormSection
              step={2}
              title="Line items"
              description="Services, stock items or charges. Pick a service or stock item, or type a custom item."
              actions={
                <Button size="sm" variant="soft" onClick={() => setLines((l) => [...l, blank()])}>
                  <Plus /> Add line
                </Button>
              }
            >
              <div className="space-y-3">
                {errors.lines && (
                  <p role="alert" className="text-[12px] font-medium text-red-600">
                    {errors.lines}
                  </p>
                )}
                {lines.map((l, i) => (
                  <div key={l.key} className="grid gap-3 rounded-xl border bg-slate-50/40 p-3.5 md:grid-cols-[1.4fr_2fr_80px_120px_90px_40px] md:items-start">
                    <Field label="Service / stock (optional)">
                      {/* One list for both: stock items carry negative values so they never clash with service ids. */}
                      <SearchSelect
                        id={`invoice-line-${l.key}-item`}
                        noneLabel="Custom item"
                        disabled={!canEdit}
                        value={l.stockItemId ? -l.stockItemId : l.serviceId}
                        options={[
                          ...(services ?? []).map((s) => ({
                            value: s.id,
                            label: s.name,
                            hint: `Service · ${s.code}`,
                            meta: formatMoney(s.effectivePrice),
                          })),
                          ...(stockItems ?? []).map((p) => ({
                            value: -p.id,
                            label: p.name,
                            hint: `Stock · ${p.code} · ${p.quantity} ${p.unit} left`,
                            meta: formatMoney(p.salePrice),
                          })),
                        ]}
                        onChange={(value) => {
                          const part = stockItems?.find((x) => -x.id === value);
                          if (part) {
                            const { discount: _d, quantity: _q, ...patch } = stockInvoiceLine(part);
                            update(l.key, patch);
                            return;
                          }
                          const s = services?.find((x) => x.id === value);
                          update(
                            l.key,
                            s
                              ? {
                                  serviceId: s.id,
                                  stockItemId: null,
                                  description: s.name,
                                  rate: s.effectivePrice,
                                  gstRate: s.gstApplicable ? s.gstRate : 0,
                                }
                              : { serviceId: null, stockItemId: null },
                          );
                        }}
                      />
                    </Field>
                    <Field label="Description" required error={lineError(i, 'description')}>
                      <Input value={l.description} maxLength={500} placeholder="What was supplied or done" onChange={(e) => update(l.key, { description: e.target.value })} />
                    </Field>
                    <Field label="Qty" required error={lineError(i, 'quantity')}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        value={l.quantity} placeholder={PLACEHOLDERS.QUANTITY}
                        onChange={(e) =>
                          update(l.key, {
                            quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1),
                          })
                        }
                      />
                    </Field>
                    <Field label="Rate (₹)" required error={lineError(i, 'rate')}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={l.rate} placeholder={PLACEHOLDERS.AMOUNT}
                        onChange={(e) =>
                          update(l.key, {
                            rate: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </Field>
                    <Field label="GST %">
                      <NativeSelect value={l.gstRate} onChange={(e) => update(l.key, { gstRate: Number(e.target.value) })}>
                        {[0, 5, 12, 18, 28].map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:mt-[26px]"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </FormSection>
            <FormSection step={3} title="Options" description="GST, discount and notes printed on the invoice.">
              <InvoiceOptions value={opts} onChange={setOpts} />
            </FormSection>
          </FormCard>
        </fieldset>
        <Card className="p-5 xl:sticky xl:top-[97px] xl:self-start">
          <p className="mb-4 font-display text-[15px] font-bold">Totals</p>
          <TotalsSummary totals={preview.data} applyGst={opts.applyGst} isInterState={opts.isInterState} />
          {!isDraft && (
            <Button className="mt-6 w-full" size="lg" loading={actions.createManual.isPending} onClick={submit}>
              Create invoice
            </Button>
          )}
          {isDraft && (
            <div className="mt-6 space-y-2">
              {can('forInvoice.audit') && (
                <Button className="w-full" size="lg" loading={draftActions.approve.isPending} onClick={() => setConfirm('approve')}>
                  <CheckCircle2 /> {FOR_INVOICE.APPROVE}
                </Button>
              )}
              {canEdit && (
                <Button className="w-full" variant="outline" loading={draftActions.update.isPending} onClick={() => void saveDraft()}>
                  <Save /> Save changes
                </Button>
              )}
              {canEdit && (
                <Button className="w-full" variant="ghost" onClick={() => setConfirm('discard')}>
                  <Trash2 className="text-red-500" /> {FOR_INVOICE.DISCARD}
                </Button>
              )}
            </div>
          )}
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="mt-2 text-center text-xs font-medium text-red-600">
              Fix the highlighted fields to continue.
            </p>
          )}
        </Card>
      </div>
      {isDraft && (
        <>
          <ConfirmDialog
            open={confirm === 'approve'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={FOR_INVOICE.APPROVE_TITLE}
            description={`${formatMoney(preview.data?.grandTotal ?? bill?.grandTotal)}. ${FOR_INVOICE.APPROVE_NOTE}`}
            confirmLabel={FOR_INVOICE.APPROVE}
            loading={draftActions.update.isPending || draftActions.approve.isPending}
            onConfirm={() => void approve()}
          />
          <ConfirmDialog
            open={confirm === 'discard'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={FOR_INVOICE.DISCARD_TITLE}
            description={FOR_INVOICE.DISCARD_NOTE}
            confirmLabel={FOR_INVOICE.DISCARD}
            destructive
            requireReason
            loading={draftActions.discard.isPending}
            onConfirm={(reason) => draftId && draftActions.discard.mutate({ id: draftId, reason }, { onSuccess: () => navigate(ROUTES.FOR_INVOICE) })}
          />
        </>
      )}
    </>
  );
}
