/**
 * Roles & permissions: a searchable grid of role cards (what each role can open), with a
 * View / Edit dialog holding the full permission matrix
 * (view / create / edit / delete / approve / export / assign / manage).
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Eye, Info, Lock, Pencil, Plus, Save, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { useRoleActions, usePermissions } from '@/hooks/usePeople';
import { useRoles } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFormErrors } from '@/hooks/useFormErrors';
import { roleSchema } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { PERMISSION_MATRIX, PLACEHOLDERS, SERIAL_COLUMN } from '@/constants/ui';
import { cn, humanize, serialNumber } from '@/lib/utils';
import type { Role } from '@/types';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, LoadingBlock, PageHeader } from '@/components/common';
import { Button, Card, Checkbox, Input } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'assign', 'manage'];
const SUPER_ADMIN = 'SUPER_ADMIN';
const APP_ROLES = ['TECHNICIAN', 'CUSTOMER'];

/** "masterData" → "Master Data". */
const moduleLabel = (module: string) => humanize(module.replace(/([A-Z])/g, '_$1'));

export default function RolesPage() {
  const { can } = useAuth();
  const roles = useRoles();
  const perms = usePermissions();
  const actions = useRoleActions();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<{ id: number; mode: 'view' | 'edit' } | null>(null);
  const role = open ? roles.data?.find((r) => r.id === open.id) : undefined;
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '' });
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const { errors, validate, clear, fromServer, reset } = useFormErrors();
  const canManage = can('roles.manage');

  const createRole = () => {
    const parsed = validate(roleSchema, newRole);
    if (!parsed) return;
    actions.create.mutate(
      { ...parsed, permissionCodes: [] },
      {
        onSuccess: (r) => {
          setNewOpen(false);
          setNewRole({ name: '' });
          setOpen({ id: r.id, mode: 'edit' }); // a new role starts empty — go straight to ticking permissions
        },
        onError: (e) => fromServer(e),
      },
    );
  };

  const isSuper = role?.code === SUPER_ADMIN;
  const editable = open?.mode === 'edit' && canManage && !isSuper;

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

  /** Every permission code that exists, optionally limited to one module or one action. */
  const codesWhere = (filter: { module?: string; action?: string } = {}) =>
    modules.flatMap(([m, acts]) => (filter.module && filter.module !== m ? [] : Array.from(acts).filter((a) => !filter.action || filter.action === a).map((a) => `${m}.${a}`)));
  /** Checkbox state for a group: all on, none on, or some on ("indeterminate"). */
  const groupState = (codes: string[]): boolean | 'indeterminate' => {
    if (isSuper) return codes.length > 0;
    const on = codes.filter((c) => granted.has(c)).length;
    return on === 0 ? false : on === codes.length ? true : 'indeterminate';
  };
  /** Ticks the whole group, or clears it when it is already fully ticked. */
  const toggleGroup = (codes: string[]) => {
    const next = new Set(granted);
    const allOn = codes.every((c) => next.has(c));
    codes.forEach((c) => (allOn ? next.delete(c) : next.add(c)));
    setGranted(next);
  };
  const allCodes = codesWhere();
  /** Whether a permission is on for the open role (Super Admin: always). */
  const has = (code: string) => isSuper || granted.has(code);
  const grantedCount = allCodes.filter((c) => granted.has(c)).length;
  const savedCodes = new Set(role?.permissions.map((p) => p.permission.code) ?? []);
  const dirty = editable && (savedCodes.size !== granted.size || Array.from(granted).some((c) => !savedCodes.has(c)));

  /** Modules a role can open (any permission in the module). Super Admin: all. */
  const modulesOf = (r: Role) => {
    if (r.code === SUPER_ADMIN) return modules.map(([m]) => m);
    const set = new Set(r.permissions.map((p) => p.permission.module));
    return modules.map(([m]) => m).filter((m) => set.has(m));
  };

  const q = search.trim().toLowerCase();
  const visibleRoles = (roles.data ?? []).filter(
    (r) => !q || [r.name, r.code, r.description ?? '', ...modulesOf(r).map(moduleLabel)].some((t) => t.toLowerCase().includes(q)),
  );

  if (roles.isLoading || perms.isLoading) return <LoadingBlock rows={8} />;
  if (roles.error) return <ErrorState message={(roles.error as Error).message} onRetry={() => roles.refetch()} />;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Permissions are enforced by the API on every request; menus simply hide what a role cannot use."
        breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Roles & Permissions' }]}
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, description or module…" className="pl-9" aria-label="Search roles" />
          </div>
          {canManage && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus /> Add role
            </Button>
          )}
        </div>

        {/* Role cards */}
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleRoles.map((r) => {
            const mods = modulesOf(r);
            const RoleIcon = r.code === SUPER_ADMIN ? Crown : APP_ROLES.includes(r.code) ? UserRound : r.isSystem ? Lock : ShieldCheck;
            const canEditRole = canManage && r.code !== SUPER_ADMIN;
            return (
              <div key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-brand-blue bg-white shadow-card transition-shadow hover:shadow-elevated">
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue ring-1 ring-brand-blue-100">
                    <RoleIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-display text-[14.5px] font-bold text-brand-navy">{r.name}</p>
                      <span className="rounded-md bg-brand-blue-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-blue ring-1 ring-brand-blue-100">{r.code}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{r.description || `${r._count?.users ?? 0} user(s) with this role.`}</p>
                  </div>
                  {r.code !== SUPER_ADMIN && canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${r.name}`}
                      // A role still held by people can't be removed — the server refuses it too.
                      disabled={(r._count?.users ?? 0) > 0}
                      title={(r._count?.users ?? 0) > 0 ? `${r._count?.users} user(s) have this role — move them to another role first` : 'Delete role'}
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 className="text-red-500" />
                    </Button>
                  )}
                </div>

                {/* Module access */}
                <div className="mx-4 flex-1 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Sidebar access</p>
                    <span className="num rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-brand-blue ring-1 ring-brand-blue-100">{mods.length}</span>
                  </div>
                  {mods.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-muted-foreground">{APP_ROLES.includes(r.code) ? PERMISSION_MATRIX.APP_ROLE_NOTE : 'No modules yet — use Edit to grant access.'}</p>
                  ) : (
                    <ul className="scrollbar-thin grid max-h-[132px] grid-cols-2 gap-1 overflow-y-auto pr-1">
                      {mods.map((m) => (
                        <li key={m} className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-100 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-700">
                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white">
                            <Check className="h-2 w-2" strokeWidth={4} />
                          </span>
                          <span className="truncate" title={moduleLabel(m)}>
                            {moduleLabel(m)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 p-4">
                  <Button size="sm" variant="outline" onClick={() => setOpen({ id: r.id, mode: 'view' })} className={cn(!canEditRole && 'col-span-2')}>
                    <Eye /> View
                  </Button>
                  {canEditRole && (
                    <Button size="sm" onClick={() => setOpen({ id: r.id, mode: 'edit' })}>
                      <Pencil /> Edit
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {visibleRoles.length === 0 && <EmptyState title="No roles found" description="Try a different search." />}
      </Card>

      {/* View / edit permissions */}
      <Dialog open={!!role} onOpenChange={(o) => !o && setOpen(null)}>
        {role && (
          <DialogContent size="xl" className="max-w-6xl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader title={`${role.name} — ${editable ? 'edit permissions' : 'permissions'}`} description={`${role.code} · ${role._count?.users ?? 0} user(s)`} />
            <DialogBody className="p-0">
              {!editable && (
                <div className="flex items-start gap-2.5 border-b bg-brand-blue-50/50 px-5 py-3 text-[13px] text-slate-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                  {isSuper ? PERMISSION_MATRIX.READ_ONLY_SUPER : canManage ? PERMISSION_MATRIX.READ_ONLY_VIEW : PERMISSION_MATRIX.READ_ONLY_NO_RIGHTS}
                </div>
              )}
              {APP_ROLES.includes(role.code) && (
                <div className="flex items-start gap-2.5 border-b bg-amber-50/60 px-5 py-3 text-[13px] text-slate-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {PERMISSION_MATRIX.APP_ROLE_NOTE}
                </div>
              )}
              <div className="scrollbar-thin max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[860px] table-fixed border-collapse text-[13px]">
                  <colgroup>
                    <col className="w-16" />
                    <col className="w-[230px]" />
                    {ACTIONS.map((a) => (
                      <col key={a} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className={cn('px-4 py-3', SERIAL_COLUMN.CLASS)}>{SERIAL_COLUMN.HEADER}</th>
                      <th className="px-4 py-3 text-left">
                        {editable ? (
                          <label className="inline-flex cursor-pointer items-center gap-2.5">
                            <Checkbox checked={groupState(allCodes)} onCheckedChange={() => toggleGroup(allCodes)} aria-label={PERMISSION_MATRIX.SELECT_ALL} />
                            {PERMISSION_MATRIX.MODULE}
                            <span className="font-medium normal-case tracking-normal text-slate-400">· {PERMISSION_MATRIX.SELECT_ALL}</span>
                          </label>
                        ) : (
                          PERMISSION_MATRIX.MODULE
                        )}
                      </th>
                      {ACTIONS.map((a) => {
                        const col = codesWhere({ action: a });
                        return (
                          <th key={a} className="px-1 py-3 text-center align-top">
                            <span className="block">{a}</span>
                            {editable && col.length > 0 && (
                              <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-400 hover:bg-white hover:text-brand-blue">
                                <Checkbox className="h-3.5 w-3.5 rounded-[4px] [&_svg]:h-2.5 [&_svg]:w-2.5" checked={groupState(col)} onCheckedChange={() => toggleGroup(col)} aria-label={`${PERMISSION_MATRIX.SELECT_ALL} ${a}`} />
                                {PERMISSION_MATRIX.ALL}
                              </label>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(([module, acts], index) => {
                      const rowCodes = codesWhere({ module });
                      const on = rowCodes.filter(has).length;
                      return (
                        <tr key={module} className="border-b border-slate-100 transition-colors last:border-0 even:bg-slate-50/40 hover:bg-brand-blue-50/40">
                          <td className={cn('px-4 py-2.5', SERIAL_COLUMN.CLASS, SERIAL_COLUMN.CELL_TEXT)}>{serialNumber(index)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              {editable ? (
                                <label className="inline-flex min-w-0 cursor-pointer items-center gap-2.5">
                                  <Checkbox checked={groupState(rowCodes)} onCheckedChange={() => toggleGroup(rowCodes)} aria-label={`${PERMISSION_MATRIX.SELECT_ALL} ${module}`} />
                                  <span className="truncate font-semibold text-brand-navy">{moduleLabel(module)}</span>
                                </label>
                              ) : (
                                <span className="truncate font-semibold text-brand-navy">{moduleLabel(module)}</span>
                              )}
                              <span
                                className={cn(
                                  'num shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  on === rowCodes.length ? 'bg-emerald-50 text-emerald-700' : on === 0 ? 'bg-slate-100 text-slate-400' : 'bg-brand-blue-50 text-brand-blue',
                                )}
                              >
                                {on}/{rowCodes.length}
                              </span>
                            </div>
                          </td>
                          {ACTIONS.map((a) => {
                            const code = `${module}.${a}`;
                            if (!acts.has(a)) {
                              return (
                                <td key={a} className="px-1 py-2.5 text-center">
                                  <span className="text-slate-200">—</span>
                                </td>
                              );
                            }
                            return (
                              <td key={a} className="px-1 py-2.5 text-center">
                                {editable ? (
                                  <Checkbox className="align-middle" checked={granted.has(code)} onCheckedChange={() => toggle(code)} aria-label={code} />
                                ) : has(code) ? (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-label={`${code} granted`}>
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                  </span>
                                ) : (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-300" aria-label={`${code} not granted`}>
                                    <X className="h-3 w-3" strokeWidth={3} />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DialogBody>
            <DialogFooter className="sm:justify-between">
              <div className="flex items-center gap-2">
                {editable && (
                  <span className="num text-xs text-muted-foreground">
                    {grantedCount} / {allCodes.length} {PERMISSION_MATRIX.SELECTED}
                  </span>
                )}
                {dirty && <Badge tone="amber">{PERMISSION_MATRIX.UNSAVED}</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(null)}>
                  {editable ? 'Cancel' : 'Close'}
                </Button>
                {!editable && canManage && !isSuper && (
                  <Button onClick={() => setOpen({ id: role.id, mode: 'edit' })}>
                    <Pencil /> Edit
                  </Button>
                )}
                {editable && (
                  <Button disabled={!dirty} loading={actions.update.isPending} onClick={() => actions.update.mutate({ id: role.id, body: { permissionCodes: Array.from(granted) } }, { onSuccess: () => setOpen(null) })}>
                    <Save /> Save permissions
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* New role */}
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) reset(); }}>
        <DialogContent size="sm">
          <DialogHeader title="New role" description="Start empty, then tick permissions." />
          <DialogBody className="space-y-4">
            <Field label="Role name" required error={errors.name} htmlFor="role-name">
              <Input id="role-name" placeholder={PLACEHOLDERS.ROLE_NAME} value={newRole.name} autoFocus onChange={(e) => { setNewRole({ ...newRole, name: e.target.value }); clear('name'); }} maxLength={100} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button loading={actions.create.isPending} onClick={createRole}>Create role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete role ${toDelete?.name}?`} description={toDelete?.isSystem ? 'This is a built-in role. Features that rely on it (for example app sign-up for Customer, or job assignment for Technician) stop working until a role with the same code is created again.' : 'The role and its permission set are removed.'} confirmLabel="Delete" destructive loading={actions.remove.isPending} onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </>
  );
}
