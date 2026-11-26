/**
 * Service categories: add, rename, (de)activate, reorder, delete when unused.
 */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useServiceActions } from '@/hooks/useCatalog';
import { useCategories } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFormErrors } from '@/hooks/useFormErrors';
import { categorySchema } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { LIMITS, PLACEHOLDERS, ROW_ACTIONS } from '@/constants/ui';
import type { Category } from '@/types';
import { ActiveBadge, ConfirmDialog, EmptyState, ErrorState, Field, LoadingBlock, PageHeader } from '@/components/common';
import { Button, Card, Input, Label, Switch, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

const EMPTY = { name: '', description: '', icon: '', isActive: true };

export default function CategoriesPage() {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useCategories();
  const actions = useServiceActions();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [order, setOrder] = useState<Category[]>([]);
  const { errors, validate, clear, fromServer, reset } = useFormErrors();
  const setField = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clear(key);
  };

  useEffect(() => setOrder(data ?? []), [data]);
  useEffect(() => {
    reset();
    if (editing === 'new') setForm(EMPTY);
    else if (editing) setForm({ name: editing.name, description: editing.description ?? '', icon: editing.icon ?? '', isActive: editing.isActive });
  }, [editing, reset]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    actions.reorderCategories.mutate(next.map((c) => c.id));
  };

  const save = () => {
    const parsed = validate(categorySchema, form);
    if (!parsed) return;
    const body = { ...parsed, description: parsed.description || null, icon: parsed.icon || null };
    const handlers = { onSuccess: () => setEditing(null), onError: (e: unknown) => fromServer(e) };
    if (editing === 'new') actions.createCategory.mutate(body, handlers);
    else if (editing) actions.updateCategory.mutate({ id: editing.id, body }, handlers);
  };

  return (
    <>
      <PageHeader
        title="Service Categories"
        description="Group services for the customer app. Order here controls display order."
        breadcrumbs={[{ label: 'Services', to: ROUTES.SERVICES }, { label: 'Categories' }]}
        actions={can('services.create') && <Button onClick={() => setEditing('new')}><Plus /> Add category</Button>}
      />
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !order.length ? (
        <Card><EmptyState icon={FolderTree} title="No categories" action={<Button onClick={() => setEditing('new')}><Plus /> Add category</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {order.map((c, i) => (
            <Card key={c.id} className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue-400 font-display text-lg font-extrabold text-white">{c.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display font-bold text-brand-navy">{c.name}</p>
                  <ActiveBadge active={c.isActive} />
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{c.description || 'No description'}</p>
                <p className="mt-2 text-xs font-semibold text-brand-blue">{c._count?.services ?? 0} active services</p>
              </div>
              {can('services.edit') && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {can('services.edit') && <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(c)}><Pencil /></Button>}
                {can('services.delete') && <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setToDelete(c)}><Trash2 className="text-red-500" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader title={editing === 'new' ? 'Add category' : 'Edit category'} />
          <DialogBody className="space-y-4">
            <Field label="Name" required error={errors.name} htmlFor="category-name">
              <Input id="category-name" placeholder={PLACEHOLDERS.CATEGORY_NAME} value={form.name} maxLength={LIMITS.NAME_MAX} onChange={(e) => setField('name', e.target.value)} autoFocus />
            </Field>
            <Field label="Description" error={errors.description} htmlFor="category-description" counter={{ value: form.description.length, max: LIMITS.DESCRIPTION_MAX }}>
              <Textarea id="category-description" placeholder={PLACEHOLDERS.DESCRIPTION} value={form.description} maxLength={LIMITS.DESCRIPTION_MAX} onChange={(e) => setField('description', e.target.value)} />
            </Field>
            <Field label="Icon name" error={errors.icon} htmlFor="category-icon" hint="Optional Lucide icon name used by the apps, e.g. air-vent">
              <Input id="category-icon" placeholder={PLACEHOLDERS.ICON_NAME} value={form.icon} maxLength={50} onChange={(e) => setField('icon', e.target.value.toLowerCase())} />
            </Field>
            <div className="flex items-center justify-between rounded-xl border bg-slate-50/50 px-4 py-3">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setField('isActive', v)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={actions.createCategory.isPending || actions.updateCategory.isPending} onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete ${toDelete?.name}?`} description={ROW_ACTIONS.DEACTIVATE_NOTE} confirmLabel="Delete" destructive loading={actions.removeCategory.isPending} onConfirm={() => toDelete && actions.removeCategory.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </>
  );
}
