/**
 * Master Data → Stock: branch-wise spare parts and material with quantity adjustments.
 */

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useStockActions, useStockList } from '@/hooks/useStock';
import { useBranches, fieldErrors } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useFormErrors } from '@/hooks/useFormErrors';
import { emptyToNull, stockAdjustSchema, stockItemSchema } from '@/lib/validation';
import { LIMITS, PLACEHOLDERS, ROW_ACTIONS, STOCK } from '@/constants/ui';
import { ROUTES } from '@/constants/routes';
import { formatMoney, toNumber } from '@/lib/utils';
import type { StockItem } from '@/types';
import { ActiveBadge, Badge, ConfirmDialog, Field, PageHeader } from '@/components/common';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput } from '@/components/Filters';
import { Button, Input, Label, NativeSelect, Switch } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

type FormState = Record<string, string | boolean>;

const emptyForm = (branchId?: number): FormState => ({
  branchId: branchId ? String(branchId) : '',
  code: '',
  name: '',
  unit: STOCK.UNITS[0],
  hsnCode: '',
  salePrice: '',
  gstRate: String(STOCK.DEFAULT_GST_RATE),
  quantity: '0',
  lowStockLevel: '0',
  isActive: true,
});

const toForm = (s: StockItem): FormState => ({
  branchId: String(s.branchId),
  code: s.code,
  name: s.name,
  unit: s.unit,
  hsnCode: s.hsnCode ?? '',
  salePrice: String(toNumber(s.salePrice)),
  gstRate: String(toNumber(s.gstRate)),
  quantity: String(s.quantity),
  lowStockLevel: String(s.lowStockLevel),
  isActive: s.isActive,
});

export default function StockPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const { branchId: scopeBranchId } = useBranchScope();
  const { data, isLoading, error, refetch } = useStockList({ search: search || undefined, branchId: scopeBranchId });
  const { data: branches } = useBranches({ activeOnly: true });
  const actions = useStockActions();
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [adjusting, setAdjusting] = useState<{ item: StockItem; direction: 1 | -1 } | null>(null);
  const [adjustment, setAdjustment] = useState({ quantity: '', note: '' });
  const [toDelete, setToDelete] = useState<StockItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, validate, clear, fromServer, reset } = useFormErrors();

  const clearErrors = () => {
    setFormError(null);
    reset();
  };
  const openForm = (target: StockItem | 'new') => {
    clearErrors();
    setForm(target === 'new' ? emptyForm(scopeBranchId) : toForm(target));
    setEditing(target);
  };
  const openAdjust = (item: StockItem, direction: 1 | -1) => {
    clearErrors();
    setAdjustment({ quantity: '', note: '' });
    setAdjusting({ item, direction });
  };
  const setField = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    clear(key);
  };
  const showError = (e: unknown) => {
    const message = fromServer(e);
    setFormError(Object.keys(fieldErrors(e)).length ? null : message);
  };

  const save = async () => {
    setFormError(null);
    const parsed = validate(stockItemSchema, form);
    if (!parsed) return;
    const body = emptyToNull(parsed) as Record<string, unknown>;
    try {
      if (editing === 'new') await actions.create.mutateAsync(body);
      else if (editing) {
        const { branchId: _branch, quantity: _quantity, ...changes } = body;
        await actions.update.mutateAsync({ id: editing.id, body: changes });
      }
      setEditing(null);
    } catch (e) {
      showError(e);
    }
  };

  const saveAdjustment = async () => {
    setFormError(null);
    const parsed = validate(stockAdjustSchema, adjustment);
    if (!parsed || !adjusting) return;
    try {
      await actions.adjust.mutateAsync({ id: adjusting.item.id, change: adjusting.direction * parsed.quantity, note: parsed.note || null });
      setAdjusting(null);
    } catch (e) {
      showError(e);
    }
  };

  const columns: Column<StockItem>[] = [
    { key: 'code', header: 'Code', cell: (s) => s.code },
    { key: 'name', header: 'Stock Item', cell: (s) => <span className="font-semibold text-brand-navy">{s.name}</span> },
    { key: 'branch', header: 'Branch', cell: (s) => s.branch.name },
    { key: 'salePrice', header: 'Price', cell: (s) => <span className="num font-semibold">{formatMoney(s.salePrice)}</span> },
    { key: 'gst', header: 'GST', cell: (s) => `${toNumber(s.gstRate)}%` },
    {
      key: 'quantity',
      header: 'In Stock',
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span className="num font-semibold">{s.quantity} {s.unit}</span>
          {s.quantity <= s.lowStockLevel && <Badge tone="amber">{s.quantity === 0 ? 'Out of stock' : 'Low'}</Badge>}
          {can('masterData.edit') && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={`Add stock to ${s.name}`} onClick={() => openAdjust(s, 1)}><Plus /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Reduce stock of ${s.name}`} disabled={s.quantity === 0} onClick={() => openAdjust(s, -1)}><Minus /></Button>
            </>
          )}
        </div>
      ),
    },
    { key: 'isActive', header: 'Status', cell: (s) => <ActiveBadge active={s.isActive} /> },
    {
      key: 'actions',
      header: ROW_ACTIONS.HEADER,
      align: 'right',
      cell: (s) => (
        <RowActions
          onEdit={can('masterData.edit') ? () => openForm(s) : undefined}
          onDelete={can('masterData.delete') && s.isActive ? () => setToDelete(s) : undefined}
        />
      ),
    },
  ];

  const input = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <Field label={label} required={required} error={errors[key]} htmlFor={`stock-${key}`}>
      <Input id={`stock-${key}`} value={String(form[key] ?? '')} onChange={(e) => setField(key, key === 'code' ? e.target.value.toUpperCase() : e.target.value)} {...props} />
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Stock Item"
        description="Spare parts and material, branch-wise. Quantity reduces automatically when billed on an invoice."
        breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Stock Item' }]}
        actions={can('masterData.create') && <Button onClick={() => openForm('new')}><Plus /> Add stock item</Button>}
      />
      <DataTable columns={columns} rows={data} rowKey={(s) => s.id} loading={isLoading} error={error ? (error as Error).message : null} onRetry={refetch} toolbar={<FilterBar><SearchInput value={search} onChange={setSearch} placeholder="Search by name or code…" /></FilterBar>} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="lg">
          <DialogHeader title={editing === 'new' ? 'Add stock item' : 'Edit stock item'} />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch" required error={errors.branchId} htmlFor="stock-branchId">
              <NativeSelect searchable id="stock-branchId" disabled={editing !== 'new'} value={String(form.branchId)} onChange={(e) => setField('branchId', e.target.value)}>
                <option value="">Select branch</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </NativeSelect>
            </Field>
            {input('code', 'Code', { maxLength: 30 }, true)}
            {input('name', 'Item name', { maxLength: LIMITS.NAME_MAX, placeholder: PLACEHOLDERS.NAME }, true)}
            <Field label="Unit" required error={errors.unit} htmlFor="stock-unit">
              <NativeSelect id="stock-unit" value={String(form.unit)} onChange={(e) => setField('unit', e.target.value)}>
                {STOCK.UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </NativeSelect>
            </Field>
            {input('salePrice', 'Sale price (₹)', { type: 'number', min: 0, step: '0.01', placeholder: PLACEHOLDERS.AMOUNT }, true)}
            <Field label="GST %" error={errors.gstRate} htmlFor="stock-gstRate">
              <NativeSelect id="stock-gstRate" value={String(form.gstRate)} onChange={(e) => setField('gstRate', e.target.value)}>
                {STOCK.GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </NativeSelect>
            </Field>
            {editing === 'new' && input('quantity', 'Opening quantity', { type: 'number', min: 0, max: STOCK.MAX_QUANTITY }, true)}
            {input('lowStockLevel', 'Low-stock alert at', { type: 'number', min: 0, max: STOCK.MAX_QUANTITY }, true)}
            {input('hsnCode', 'HSN code', { maxLength: 20 })}
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3 sm:col-span-2">
              <Label>Active</Label>
              <Switch checked={!!form.isActive} onCheckedChange={(v) => setField('isActive', v)} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700 sm:col-span-2">{formError}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={actions.create.isPending || actions.update.isPending} onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader
            title={adjusting?.direction === 1 ? 'Add stock' : 'Reduce stock'}
            description={adjusting ? `${adjusting.item.name} · currently ${adjusting.item.quantity} ${adjusting.item.unit}` : undefined}
          />
          <DialogBody className="space-y-4">
            <Field label="Quantity" required error={errors.quantity} htmlFor="adjust-quantity">
              <Input id="adjust-quantity" type="number" min={1} value={adjustment.quantity} placeholder={PLACEHOLDERS.QUANTITY} onChange={(e) => { setAdjustment((a) => ({ ...a, quantity: e.target.value })); clear('quantity'); }} />
            </Field>
            <Field label="Note" error={errors.note} htmlFor="adjust-note">
              <Input id="adjust-note" maxLength={1000} value={adjustment.note} placeholder={PLACEHOLDERS.NOTE} onChange={(e) => setAdjustment((a) => ({ ...a, note: e.target.value }))} />
            </Field>
            {formError && <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">{formError}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button loading={actions.adjust.isPending} onClick={saveAdjustment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete ${toDelete?.name}?`} description={ROW_ACTIONS.DEACTIVATE_NOTE} confirmLabel="Delete" destructive loading={actions.remove.isPending} onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </>
  );
}
