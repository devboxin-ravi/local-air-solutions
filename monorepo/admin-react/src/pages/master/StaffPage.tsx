/**
 * Staff & technician management: roles, branch, skills, service areas, working hours, status.
 */

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HardHat, Pencil, UserPlus } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useStaffActions, useStaffHistory, useStaffList } from '@/hooks/usePeople';
import { errorMessage, fieldErrors, useBranches, useRoles, useServiceAreas, useSkills } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { formatDate, humanize, initials } from '@/lib/utils';
import { emptyToNull, staffSchema, type StaffForm } from '@/lib/validation';
import type { Staff } from '@/types';
import { Badge, Field, PageHeader, StatusBadge } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { ChipMultiSelect } from '@/components/Pickers';
import { Avatar, Button, Input, Label, NativeSelect, Switch } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

const DEFAULTS: StaffForm = { name: '', mobile: '', email: '', password: '', roleCodes: ['TECHNICIAN'], designation: '', branchId: 0, experienceYears: 0, workStartTime: '09:00', workEndTime: '18:00', isTechnician: true, isAvailable: true, status: 'ACTIVE', skillIds: [], serviceAreaIds: [] };

export default function StaffPage() {
  const { can, user } = useAuth();
  const list = useListState();
  const { data, isLoading, error, refetch } = useStaffList(list.query);
  const actions = useStaffActions();
  const { data: branches } = useBranches({ activeOnly: true });
  const { data: roles } = useRoles();
  const { data: skills } = useSkills();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<StaffForm>({ resolver: zodResolver(staffSchema), defaultValues: DEFAULTS });
  const branchId = form.watch('branchId');
  const { data: areas } = useServiceAreas(branchId || undefined);
  const history = useStaffHistory(editing && editing !== 'new' ? editing.id : undefined);
  const e = form.formState.errors;

  useEffect(() => {
    setFormError(null);
    if (editing === 'new') form.reset({ ...DEFAULTS, branchId: user?.isCompanyWide ? 0 : user?.branchId ?? 0 });
    else if (editing)
      form.reset({
        name: editing.user.name,
        mobile: editing.user.mobile,
        email: editing.user.email ?? '',
        password: '',
        roleCodes: editing.user.roles.map((r) => r.role.code),
        designation: editing.designation ?? '',
        branchId: editing.branchId,
        experienceYears: editing.experienceYears,
        workStartTime: editing.workStartTime,
        workEndTime: editing.workEndTime,
        isTechnician: editing.isTechnician,
        isAvailable: editing.isAvailable,
        status: editing.user.status as StaffForm['status'],
        skillIds: editing.skills.map((s) => s.skill.id),
        serviceAreaIds: editing.serviceAreas.map((a) => a.serviceArea.id),
      });
  }, [editing, form, user]);

  const save = form.handleSubmit(async (v) => {
    const body = emptyToNull({ ...v, password: v.password || undefined } as Record<string, unknown>);
    try {
      if (editing === 'new') await actions.create.mutateAsync(body);
      else if (editing) await actions.update.mutateAsync({ id: editing.id, body });
      setEditing(null);
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) => form.setError(k as keyof StaffForm, { message: m }));
      setFormError(errorMessage(err));
    }
  });

  const columns: Column<Staff>[] = [
    { key: 'name', header: 'Staff', cell: (s) => <div className="flex items-center gap-3"><Avatar fallback={initials(s.user.name)} /><div><p className="font-semibold text-brand-navy">{s.user.name}</p><p className="text-xs text-muted-foreground">{s.staffCode} · {s.designation ?? '—'}</p></div></div> },
    { key: 'contact', header: 'Contact', cell: (s) => <div><p>{s.user.mobile}</p><p className="text-xs text-muted-foreground">{s.user.email ?? '—'}</p></div> },
    { key: 'roles', header: 'Role', cell: (s) => <div className="flex flex-wrap gap-1">{s.user.roles.map((r) => <Badge key={r.role.id} tone={r.role.code === 'TECHNICIAN' ? 'blue' : 'violet'}>{r.role.name}</Badge>)}</div> },
    { key: 'branch', header: 'Branch', cell: (s) => s.branch.name },
    { key: 'skills', header: 'Skills', cell: (s) => <span className="line-clamp-1 max-w-[200px] text-xs text-slate-600">{s.skills.map((k) => k.skill.name).join(', ') || '—'}</span> },
    { key: 'jobs', header: 'Active jobs', align: 'right', cell: (s) => <span className="num">{s.activeJobs ?? 0}</span> },
    { key: 'status', header: 'Status', cell: (s) => <div className="flex flex-col items-start gap-1"><StatusBadge status={s.user.status} />{s.isTechnician && !s.isAvailable && <Badge tone="amber">Unavailable</Badge>}</div> },
    { key: 'edit', header: '', align: 'right', cell: (s) => can('staff.edit') && <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={(ev) => { ev.stopPropagation(); setEditing(s); }}><Pencil /></Button> },
  ];

  return (
    <>
      <PageHeader title="Staff Management" description="Technicians and office staff with logins, branch access and skills." breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Staff' }]} actions={can('staff.create') && <Button onClick={() => setEditing('new')}><UserPlus /> Add staff</Button>} />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(s) => s.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={can('staff.edit') ? (s) => setEditing(s) : undefined}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Name, staff ID, mobile…" />
            <SelectFilter placeholder="All staff" value={list.state.filters.isTechnician} onChange={(v) => list.setFilter('isTechnician', v)} options={[{ value: 'true', label: 'Technicians' }, { value: 'false', label: 'Office staff' }]} className="sm:w-40" />
            <SelectFilter placeholder="Any skill" value={list.state.filters.skillId} onChange={(v) => list.setFilter('skillId', v)} options={(skills ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <SelectFilter placeholder="Any status" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => ({ value: s, label: humanize(s) }))} className="sm:w-36" />
          </FilterBar>
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="xl">
          <DialogHeader title={editing === 'new' ? 'Add staff member' : `Edit ${editing ? editing.user.name : ''}`} description="A login is created with the mobile/email. Leave password empty to let them use “Forgot password”." />
          <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <Tabs defaultValue="profile">
                <TabsList>
                  <TabsTrigger value="profile">Profile & access</TabsTrigger>
                  <TabsTrigger value="work">Skills & areas</TabsTrigger>
                  {editing !== 'new' && <TabsTrigger value="history">Work history</TabsTrigger>}
                </TabsList>
                <TabsContent value="profile" className="grid gap-4 sm:grid-cols-3">
                  <Field label="Full name" required error={e.name?.message}><Input {...form.register('name')} maxLength={100} /></Field>
                  <Field label="Mobile" required error={e.mobile?.message}><Input {...form.register('mobile')} inputMode="numeric" maxLength={10} /></Field>
                  <Field label="Email" error={e.email?.message}><Input type="email" {...form.register('email')} /></Field>
                  <Field label={editing === 'new' ? 'Password' : 'New password'} error={e.password?.message} hint="Min 8 chars, letter + number"><Input type="password" autoComplete="new-password" {...form.register('password')} /></Field>
                  <Field label="Designation" error={e.designation?.message}><Input {...form.register('designation')} maxLength={100} /></Field>
                  <Field label="Branch" required error={e.branchId?.message}>
                    <NativeSelect {...form.register('branchId')} disabled={!user?.isCompanyWide}>
                      <option value={0}>Select branch</option>
                      {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Experience (years)" error={e.experienceYears?.message}><Input type="number" min={0} {...form.register('experienceYears')} /></Field>
                  <Field label="Shift start" error={e.workStartTime?.message}><Input type="time" {...form.register('workStartTime')} /></Field>
                  <Field label="Shift end" error={e.workEndTime?.message}><Input type="time" {...form.register('workEndTime')} /></Field>
                  <Field label="Account status"><NativeSelect {...form.register('status')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></NativeSelect></Field>
                  <Controller control={form.control} name="isTechnician" render={({ field }) => <ToggleBox label="Field technician" checked={field.value} onChange={field.onChange} />} />
                  <Controller control={form.control} name="isAvailable" render={({ field }) => <ToggleBox label="Available for jobs" checked={field.value} onChange={field.onChange} />} />
                  <Field label="Roles" required error={e.roleCodes?.message} className="sm:col-span-3">
                    <Controller control={form.control} name="roleCodes" render={({ field }) => (
                      <ChipMultiSelect
                        options={(roles ?? []).filter((r) => r.code !== 'CUSTOMER' && (r.code !== 'SUPER_ADMIN' || user?.isSuperAdmin)).map((r) => ({ id: r.id, name: r.name }))}
                        value={(roles ?? []).filter((r) => field.value.includes(r.code)).map((r) => r.id)}
                        onChange={(ids) => field.onChange((roles ?? []).filter((r) => ids.includes(r.id)).map((r) => r.code))}
                      />
                    )} />
                  </Field>
                </TabsContent>
                <TabsContent value="work" className="space-y-5">
                  <Field label="Skills"><Controller control={form.control} name="skillIds" render={({ field }) => <ChipMultiSelect options={skills ?? []} value={field.value} onChange={field.onChange} />} /></Field>
                  <Field label="Service areas" hint="Areas of the selected branch this technician covers"><Controller control={form.control} name="serviceAreaIds" render={({ field }) => <ChipMultiSelect options={areas ?? []} value={field.value} onChange={field.onChange} emptyText="No service areas for this branch yet." />} /></Field>
                </TabsContent>
                {editing !== 'new' && (
                  <TabsContent value="history">
                    {!history.data?.items.length ? (
                      <p className="py-6 text-center text-[13px] text-muted-foreground">No assignments yet.</p>
                    ) : (
                      <ul className="divide-y rounded-xl border">
                        {history.data.items.map((h) => (
                          <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                            <span><span className="font-semibold text-brand-blue">{h.booking.bookingNumber}</span> · {h.booking.customer.fullName}<span className="block text-xs text-muted-foreground">{h.booking.items.map((i) => i.serviceName).join(', ')} · {formatDate(h.booking.scheduledDate)}</span></span>
                            <StatusBadge status={h.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>
                )}
              </Tabs>
              {formError && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">{formError}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" loading={form.formState.isSubmitting}><HardHat /> Save staff</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ToggleBox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 self-end">
    <Label>{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
