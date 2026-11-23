/**
 * Generic master-data management: states, cities, branches, service areas, skills & products.
 * Hierarchy: Company → State → City → Branch → Service Area.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMasterActions, useMasterList } from '@/hooks/useCatalog';
import { useBranches, useCities, useStates, errorMessage } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import type { MasterResource } from '@/services/catalogService';
import { ActiveBadge, ConfirmDialog, Field, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput } from '@/components/Filters';
import { Button, Input, Label, NativeSelect, Switch } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';

type Row = Record<string, unknown> & { id: number; name: string; isActive: boolean };
type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'select'; required?: boolean; options?: 'states' | 'cities' | 'branches'; hint?: string; upper?: boolean };

const CONFIG: Record<string, { resource: MasterResource; title: string; description: string; fields: FieldDef[]; columns: Array<{ key: string; header: string; render?: (r: Row) => React.ReactNode }> }> = {
  states: {
    resource: 'states',
    title: 'States',
    description: 'States where the company operates.',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true, upper: true, hint: 'e.g. MP' }],
    columns: [{ key: 'code', header: 'Code' }, { key: 'cities', header: 'Cities', render: (r) => (r._count as { cities?: number })?.cities ?? 0 }],
  },
  cities: {
    resource: 'cities',
    title: 'Cities',
    description: 'Cities grouped by state.',
    fields: [{ key: 'stateId', label: 'State', type: 'select', options: 'states', required: true }, { key: 'name', label: 'Name', required: true }],
    columns: [{ key: 'state', header: 'State', render: (r) => (r.state as { name?: string })?.name }, { key: 'branches', header: 'Branches', render: (r) => (r._count as { branches?: number })?.branches ?? 0 }],
  },
  branches: {
    resource: 'branches',
    title: 'Branches',
    description: 'Operational branches. Staff, customers, bookings and reports are scoped by branch.',
    fields: [
      { key: 'stateIdUi', label: 'State', type: 'select', options: 'states', required: true },
      { key: 'cityId', label: 'City', type: 'select', options: 'cities', required: true },
      { key: 'code', label: 'Code', required: true, upper: true, hint: 'e.g. IDR-01' },
      { key: 'name', label: 'Name', required: true },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone', hint: '10-digit mobile' },
      { key: 'email', label: 'Email' },
      { key: 'gstin', label: 'GSTIN', upper: true },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
    ],
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'city', header: 'City', render: (r) => { const c = r.city as { name?: string; state?: { name?: string } }; return `${c?.name ?? ''}, ${c?.state?.name ?? ''}`; } },
      { key: 'phone', header: 'Phone' },
      { key: 'counts', header: 'Areas / Staff / Customers', render: (r) => { const c = r._count as Record<string, number>; return `${c?.serviceAreas ?? 0} / ${c?.staff ?? 0} / ${c?.customers ?? 0}`; } },
    ],
  },
  'service-areas': {
    resource: 'service-areas',
    title: 'Service Areas',
    description: 'Localities served by each branch. PIN codes map customer addresses to branches automatically.',
    fields: [
      { key: 'branchId', label: 'Branch', type: 'select', options: 'branches', required: true },
      { key: 'name', label: 'Area name', required: true },
      { key: 'pincodes', label: 'PIN codes', hint: 'Comma-separated, e.g. 452010,452011' },
      { key: 'latitude', label: 'Centre latitude', type: 'number' },
      { key: 'longitude', label: 'Centre longitude', type: 'number' },
      { key: 'radiusKm', label: 'Radius (km)', type: 'number' },
    ],
    columns: [{ key: 'branch', header: 'Branch', render: (r) => (r.branch as { name?: string })?.name }, { key: 'pincodes', header: 'PIN codes' }, { key: 'staff', header: 'Technicians', render: (r) => (r._count as { staff?: number })?.staff ?? 0 }],
  },
  skills: { resource: 'skills', title: 'Skills', description: 'Technician skills used for smart assignment.', fields: [{ key: 'name', label: 'Name', required: true }], columns: [] },
  products: {
    resource: 'products',
    title: 'Products',
    description: 'Product types customers choose when booking.',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'category', label: 'Category' }, { key: 'sortOrder', label: 'Sort order', type: 'number' }],
    columns: [{ key: 'category', header: 'Category' }],
  },
};

export default function MasterDataPage() {
  const { resource: param } = useParams();
  const [tab, setTab] = useState<'skills' | 'products'>('skills');
  const resourceKey = param === 'skills-products' ? tab : (param ?? 'states');
  const cfg = CONFIG[resourceKey] ?? CONFIG.states;
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useMasterList<Row>(cfg.resource, { search: search || undefined });
  const actions = useMasterActions(cfg.resource);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const states = useStates();
  const cities = useCities((form.stateIdUi as string) || undefined);
  const { data: branches } = useBranches();

  useEffect(() => {
    setFormError(null);
    if (editing === 'new') setForm({ isActive: true });
    else if (editing) {
      const f: Record<string, string | boolean> = { isActive: editing.isActive };
      cfg.fields.forEach((d) => (f[d.key] = editing[d.key] === null || editing[d.key] === undefined ? '' : String(editing[d.key])));
      if (resourceKey === 'branches') f.stateIdUi = String((editing.city as { state?: { id?: number } })?.state?.id ?? '');
      setForm(f);
    }
  }, [editing, cfg.fields, resourceKey]);

  const options = useMemo(() => ({ states: states.data ?? [], cities: cities.data ?? [], branches: branches ?? [] }), [states.data, cities.data, branches]);

  const save = async () => {
    const body: Record<string, unknown> = { isActive: form.isActive };
    cfg.fields.filter((f) => f.key !== 'stateIdUi').forEach((f) => {
      const v = form[f.key];
      body[f.key] = v === '' || v === undefined ? (f.required ? v : null) : f.type === 'number' || f.type === 'select' ? Number(v) : String(v).trim();
    });
    try {
      if (editing === 'new') await actions.create.mutateAsync(body);
      else if (editing) await actions.update.mutateAsync({ id: editing.id, body });
      setEditing(null);
    } catch (e) {
      setFormError(errorMessage(e));
    }
  };

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-semibold text-brand-navy">{r.name}</span> },
    ...cfg.columns.map((c) => ({ key: c.key, header: c.header, cell: (r: Row) => (c.render ? c.render(r) : String(r[c.key] ?? '—')) })),
    { key: 'isActive', header: 'Status', cell: (r) => <ActiveBadge active={r.isActive} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {can('masterData.edit') && <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(r)}><Pencil /></Button>}
          {can('masterData.delete') && <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setToDelete(r)}><Trash2 className="text-red-500" /></Button>}
        </div>
      ),
    },
  ];

  const requiredMissing = cfg.fields.some((f) => f.required && !form[f.key]);

  return (
    <>
      <PageHeader
        title={param === 'skills-products' ? 'Skills & Products' : cfg.title}
        description={cfg.description}
        breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: cfg.title }]}
        actions={can('masterData.create') && <Button onClick={() => setEditing('new')}><Plus /> Add {cfg.title.replace(/s$/, '').toLowerCase()}</Button>}
      />
      {param === 'skills-products' && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'skills' | 'products')} className="mb-4">
          <TabsList><TabsTrigger value="skills">Skills</TabsTrigger><TabsTrigger value="products">Products</TabsTrigger></TabsList>
        </Tabs>
      )}
      <DataTable columns={columns} rows={data} rowKey={(r) => r.id} loading={isLoading} error={error ? (error as Error).message : null} onRetry={refetch} toolbar={<FilterBar><SearchInput value={search} onChange={setSearch} placeholder={`Search ${cfg.title.toLowerCase()}…`} /></FilterBar>} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size={cfg.fields.length > 4 ? 'lg' : 'md'}>
          <DialogHeader title={`${editing === 'new' ? 'Add' : 'Edit'} ${cfg.title.replace(/s$/, '').toLowerCase()}`} />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {cfg.fields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required} hint={f.hint} className={cfg.fields.length <= 2 ? 'sm:col-span-2' : undefined}>
                {f.type === 'select' ? (
                  <NativeSelect value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value, ...(f.key === 'stateIdUi' ? { cityId: '' } : {}) })}>
                    <option value="">Select {f.label.toLowerCase()}</option>
                    {options[f.options as 'states' | 'cities' | 'branches'].map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </NativeSelect>
                ) : (
                  <Input type={f.type === 'number' ? 'number' : 'text'} step="any" value={String(form[f.key] ?? '')} className={f.upper ? 'uppercase' : undefined} onChange={(e) => setForm({ ...form, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value })} />
                )}
              </Field>
            ))}
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3 sm:col-span-2">
              <Label>Active</Label>
              <Switch checked={!!form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700 sm:col-span-2">{formError}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={requiredMissing} loading={actions.create.isPending || actions.update.isPending} onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete ${toDelete?.name}?`} description="Records in use cannot be deleted — deactivate them instead." confirmLabel="Delete" destructive loading={actions.remove.isPending} onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </>
  );
}
