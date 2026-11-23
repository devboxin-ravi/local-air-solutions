/**
 * Service categories: add, rename, (de)activate, reorder, delete when unused.
 */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useServiceActions } from '@/hooks/useCatalog';
import { useCategories } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { LIMITS } from '@/constants/ui';
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

  useEffect(() => setOrder(data ?? []), [data]);
  useEffect(() => {
    if (editing === 'new') setForm(EMPTY);
    else if (editing) setForm({ name: editing.name, description: editing.description ?? '', icon: editing.icon ?? '', isActive: editing.isActive });
  }, [editing]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    actions.reorderCategories.mutate(next.map((c) => c.id));
  };

  const save = () => {
    const body = { ...form, name: form.name.trim(), description: form.description.trim() || null, icon: form.icon.trim() || null };
    if (editing === 'new') actions.createCategory.mutate(body, { onSuccess: () => setEditing(null) });
    else if (editing) actions.updateCategory.mutate({ id: editing.id, body }, { onSuccess: () => setEditing(null) });
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
            <Field label="Name" required error={form.name.trim().length > 0 && form.name.trim().length < 2 ? 'Min 2 characters' : undefined}>
              <Input value={form.name} maxLength={LIMITS.NAME_MAX} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Description" counter={{ value: form.description.length, max: LIMITS.DESCRIPTION_MAX }}>
              <Textarea value={form.description} maxLength={LIMITS.DESCRIPTION_MAX} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Icon name" hint="Optional Lucide icon name used by the apps, e.g. air-vent"><Input value={form.icon} maxLength={50} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={form.name.trim().length < 2} loading={actions.createCategory.isPending || actions.updateCategory.isPending} onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete ${toDelete?.name}?`} description="Categories that contain services cannot be deleted — deactivate them instead." confirmLabel="Delete" destructive loading={actions.removeCategory.isPending} onConfirm={() => toDelete && actions.removeCategory.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </>
  );
}
