/**
 * Roles & permissions matrix (view / create / edit / delete / approve / export / assign / manage).
 */

import { useEffect, useMemo, useState } from 'react';
import { Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useRoleActions, usePermissions } from '@/hooks/usePeople';
import { useRoles } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { cn, humanize } from '@/lib/utils';
import type { Role } from '@/types';
import { Badge, ConfirmDialog, ErrorState, Field, LoadingBlock, PageHeader } from '@/components/common';
import { Button, Card, Checkbox, Input } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'assign', 'manage'];

export default function RolesPage() {
  const { can } = useAuth();
  const roles = useRoles();
  const perms = usePermissions();
  const actions = useRoleActions();
  const [roleId, setRoleId] = useState<number | null>(null);
  const role = roles.data?.find((r) => r.id === roleId) ?? roles.data?.[0];
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const editable = can('roles.manage') && role?.code !== 'SUPER_ADMIN';

  useEffect(() => setGranted(new Set(role?.permissions.map((p) => p.permission.code) ?? [])), [role]);

  const modules = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (perms.data ?? []).forEach((p) => m.set(p.module, (m.get(p.module) ?? new Set()).add(p.action)));
    return Array.from(m.entries());
  }, [perms.data]);

  const toggle = (code: string) => {
    const next = new Set(granted);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setGranted(next);
  };

  if (roles.isLoading || perms.isLoading) return <LoadingBlock rows={8} />;
  if (roles.error) return <ErrorState message={(roles.error as Error).message} onRetry={() => roles.refetch()} />;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Permissions are enforced by the API on every request; menus simply hide what a role cannot use."
        breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Roles & Permissions' }]}
        actions={can('roles.manage') && <Button onClick={() => setNewOpen(true)}><Plus /> New role</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-2">
          {roles.data?.map((r) => (
            <button key={r.id} type="button" onClick={() => setRoleId(r.id)} className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors', role?.id === r.id ? 'bg-brand-blue-50 text-brand-blue' : 'hover:bg-slate-50')}>
              <span>
                <span className="block text-[13.5px] font-semibold">{r.name}</span>
                <span className="block text-xs text-muted-foreground">{r._count?.users ?? 0} user(s) · {r.permissions.length} permissions</span>
              </span>
              {r.isSystem && <Lock className="h-3.5 w-3.5 text-slate-400" />}
            </button>
          ))}
        </Card>
        {role && (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="font-display text-lg font-bold text-brand-navy">{role.name}</p>
                <p className="text-xs text-muted-foreground">{role.code}{role.code === 'SUPER_ADMIN' ? ' · full access, cannot be restricted' : ''}{['TECHNICIAN', 'CUSTOMER'].includes(role.code) ? ' · uses the mobile app; admin permissions not required' : ''}</p>
              </div>
              <div className="flex gap-2">
                {!role.isSystem && can('roles.manage') && <Button variant="ghost" onClick={() => setToDelete(role)}><Trash2 className="text-red-500" /> Delete</Button>}
                {editable && <Button loading={actions.update.isPending} onClick={() => actions.update.mutate({ id: role.id, body: { permissionCodes: Array.from(granted) } })}><Save /> Save permissions</Button>}
              </div>
            </div>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 text-left">Module</th>
                    {ACTIONS.map((a) => <th key={a} className="px-2 py-3 text-center">{a}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {modules.map(([module, acts]) => (
                    <tr key={module} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-semibold text-brand-navy">{humanize(module.replace(/([A-Z])/g, '_$1'))}</td>
                      {ACTIONS.map((a) => {
                        const code = `${module}.${a}`;
                        return (
                          <td key={a} className="px-2 py-2.5 text-center">
                            {acts.has(a) ? <Checkbox checked={role.code === 'SUPER_ADMIN' || granted.has(code)} disabled={!editable} onCheckedChange={() => toggle(code)} aria-label={code} /> : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!editable && <p className="border-t bg-slate-50 px-5 py-3 text-xs text-muted-foreground"><Badge tone="neutral">Read-only</Badge> {role.code === 'SUPER_ADMIN' ? 'Super Admin always has every permission.' : 'You need Roles → Manage to change permissions.'}</p>}
          </Card>
        )}
      </div>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent size="sm">
          <DialogHeader title="New role" description="Start empty, then tick permissions." />
          <DialogBody className="space-y-4">
            <Field label="Role name" required><Input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} maxLength={100} /></Field>
            <Field label="Code" required hint="UPPER_SNAKE_CASE, e.g. ACCOUNTANT"><Input value={newRole.code} onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') })} maxLength={50} /></Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={newRole.name.trim().length < 2 || newRole.code.length < 2} loading={actions.create.isPending} onClick={() => actions.create.mutate({ ...newRole, name: newRole.name.trim(), permissionCodes: [] }, { onSuccess: (r) => { setNewOpen(false); setRoleId(r.id); setNewRole({ code: '', name: '' }); } })}>Create role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete role ${toDelete?.name}?`} description="Users lose the permissions from this role immediately." confirmLabel="Delete" destructive loading={actions.remove.isPending} onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => { setToDelete(null); setRoleId(null); } })} />
    </>
  );
}
