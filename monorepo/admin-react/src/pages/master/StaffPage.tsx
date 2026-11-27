/**
 * Staff & technician management: roles, branch, skills, service areas, working hours, status.
 */

import { useEffect, useState } from 'react';
import type * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Building2, HardHat, KeyRound, UserPlus, UserRound } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useStaffActions, useStaffHistory, useStaffList } from '@/hooks/usePeople';
import { errorMessage, fieldErrors, useBranches, useRoles, useServiceAreas, useSkills } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { ROUTES } from '@/constants/routes';
import { LIMITS, PLACEHOLDERS, ROW_ACTIONS } from '@/constants/ui';
import { formatDate, humanize, initials } from '@/lib/utils';
import { emptyToNull, staffSchema, type StaffForm } from '@/lib/validation';
import type { Staff } from '@/types';
import { Badge, ConfirmDialog, Field, PageHeader, StatusBadge } from '@/components/common';
import { DataTable, RowActions, type Column } from '@/components/DataTable';
import { FilterBar, SearchInput, SelectFilter } from '@/components/Filters';
import { ChipMultiSelect, MultiSelectDropdown } from '@/components/Pickers';
import { Avatar, Button, Input, NativeSelect, Switch } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

type StaffTab = 'profile' | 'work' | 'history';

/** Role that makes a staff member a field technician (assignable to jobs). */
const TECHNICIAN_ROLE = 'TECHNICIAN';

const DEFAULTS: StaffForm = { name: '', mobile: '', email: '', username: '', password: '', roleCodes: ['TECHNICIAN'], designation: '', branchId: 0, experienceYears: 0, workStartTime: '09:00', workEndTime: '18:00', isTechnician: true, isAvailable: true, status: 'ACTIVE', skillIds: [], serviceAreaIds: [] };

export default function StaffPage() {
  const { can, user } = useAuth();
  const { branchId: scopeBranchId } = useBranchScope();
  const list = useListState();
  const { data, isLoading, error, refetch } = useStaffList(list.query);
  const actions = useStaffActions();
  const { data: branches } = useBranches({ activeOnly: true });
  const { data: roles } = useRoles();
  const { data: skills } = useSkills();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Staff | null>(null);
  const [tab, setTab] = useState<StaffTab>('profile');
  /** Opens the editor on its first step. */
  const openEditor = (target: Staff | 'new') => {
    setTab('profile');
    setEditing(target);
  };
  const form = useForm<StaffForm>({ resolver: zodResolver(staffSchema), defaultValues: DEFAULTS });
  const branchId = form.watch('branchId');
  const isTechnicianRole = form.watch('roleCodes').includes(TECHNICIAN_ROLE);
  const { data: areas } = useServiceAreas(branchId || undefined);
  const history = useStaffHistory(editing && editing !== 'new' ? editing.id : undefined);
  const e = form.formState.errors;

  useEffect(() => {
    setFormError(null);
    if (editing === 'new') form.reset({ ...DEFAULTS, branchId: user?.isCompanyWide ? scopeBranchId ?? 0 : user?.branchId ?? 0 });
    else if (editing)
      form.reset({
        name: editing.user.name,
        mobile: editing.user.mobile,
        email: editing.user.email ?? '',
        username: editing.user.username ?? '',
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
  }, [editing, form, user, scopeBranchId]);

  const save = form.handleSubmit(async (v) => {
    // "Field technician" is not a separate switch: anyone with the Technician role gets jobs.
    const isTechnician = v.roleCodes.includes(TECHNICIAN_ROLE);
    const body = emptyToNull({ ...v, isTechnician, isAvailable: isTechnician && v.isAvailable, password: v.password || undefined } as Record<string, unknown>);
    try {
      const saved = editing === 'new' ? await actions.create.mutateAsync(body) : editing ? await actions.update.mutateAsync({ id: editing.id, body }) : null;
      // Saving from step 1 continues to step 2 (button or Enter); saving from step 2 closes.
      if (tab === 'profile' && saved) {
        // Keep the dialog open on the saved record (a new member now has an id) and go to step 2.
        setEditing(saved as Staff);
        setTab('work');
      } else {
        setEditing(null);
      }
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) => form.setError(k as keyof StaffForm, { message: m }));
      setFormError(errorMessage(err));
    }
  });

  const columns: Column<Staff>[] = [
    { key: 'name', header: 'Staff', cell: (s) => <div className="flex items-center gap-3"><Avatar fallback={initials(s.user.name)} /><div><p className="font-semibold text-brand-navy">{s.user.name}</p><p className="text-xs text-muted-foreground">{s.staffCode} · {s.designation ?? '—'}</p></div></div> },
    { key: 'contact', header: 'Contact', cell: (s) => <div><p>{s.user.mobile}</p><p className="text-xs text-muted-foreground">{s.user.username ? `@${s.user.username}` : s.user.email ?? '—'}</p></div> },
    { key: 'roles', header: 'Role', cell: (s) => <div className="flex flex-wrap gap-1">{s.user.roles.map((r) => <Badge key={r.role.id} tone={r.role.code === 'TECHNICIAN' ? 'blue' : 'violet'}>{r.role.name}</Badge>)}</div> },
    { key: 'branch', header: 'Branch', cell: (s) => s.branch.name },
    { key: 'skills', header: 'Skills', cell: (s) => <span className="line-clamp-1 max-w-[200px] text-xs text-slate-600">{s.skills.map((k) => k.skill.name).join(', ') || '—'}</span> },
    { key: 'jobs', header: 'Active jobs', align: 'right', cell: (s) => <span className="num">{s.activeJobs ?? 0}</span> },
    { key: 'status', header: 'Status', cell: (s) => <div className="flex flex-col items-start gap-1"><StatusBadge status={s.user.status} />{s.isTechnician && !s.isAvailable && <Badge tone="amber">Unavailable</Badge>}</div> },
    {
      key: 'actions',
      header: ROW_ACTIONS.HEADER,
      align: 'right',
      cell: (s) => (
        <RowActions
          onEdit={can('staff.edit') ? () => openEditor(s) : undefined}
          // Your own login cannot be deleted (the server refuses it too).
          onDelete={can('staff.delete') && s.userId !== user?.id ? () => setToDelete(s) : undefined}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Staff Management" description="Technicians and office staff with logins, branch access and skills." breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Staff' }]} actions={can('staff.create') && <Button onClick={() => openEditor('new')}><UserPlus /> Add staff</Button>} />
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
        onRowClick={can('staff.edit') ? (s) => openEditor(s) : undefined}
        toolbar={
          <FilterBar>
            <SearchInput value={list.state.search} onChange={list.setSearch} placeholder="Name, staff ID, mobile…" />
            <SelectFilter placeholder="All staff" value={list.state.filters.isTechnician} onChange={(v) => list.setFilter('isTechnician', v)} options={[{ value: 'true', label: 'Technicians' }, { value: 'false', label: 'Office staff' }]} className="sm:w-40" />
            <SelectFilter searchable placeholder="Any skill" value={list.state.filters.skillId} onChange={(v) => list.setFilter('skillId', v)} options={(skills ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <SelectFilter placeholder="Any status" value={list.state.filters.status} onChange={(v) => list.setFilter('status', v)} options={['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => ({ value: s, label: humanize(s) }))} className="sm:w-36" />
          </FilterBar>
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="xl" onOpenAutoFocus={(ev) => ev.preventDefault()}>
          <DialogHeader title={editing === 'new' ? 'Add staff member' : `Edit ${editing ? editing.user.name : ''}`} description="A login is created with the mobile/username. Leave password empty to let them use “Forgot password”." />
          <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <Tabs value={tab} onValueChange={(v) => setTab(v as StaffTab)}>
                <TabsList>
                  <TabsTrigger value="profile">1. Profile & access</TabsTrigger>
                  <TabsTrigger value="work" disabled={editing === 'new'}>2. Skills & areas</TabsTrigger>
                  {editing !== 'new' && <TabsTrigger value="history">Work history</TabsTrigger>}
                </TabsList>
                <TabsContent value="profile" className="space-y-6">
                  <FormGroup icon={<UserRound />} title="Personal details">
                    <Field label="Full name" required error={e.name?.message}><Input {...form.register('name')} placeholder={PLACEHOLDERS.FULL_NAME} maxLength={100} /></Field>
                    <Field label="Mobile" required error={e.mobile?.message}><Input {...form.register('mobile')} placeholder={PLACEHOLDERS.MOBILE} inputMode="numeric" maxLength={10} /></Field>
                    <Field label="Email" error={e.email?.message}><Input type="email" {...form.register('email')} placeholder={PLACEHOLDERS.EMAIL} /></Field>
                    <Field label="Designation" error={e.designation?.message}><Input {...form.register('designation')} placeholder={PLACEHOLDERS.DESIGNATION} maxLength={100} /></Field>
                    <Field label="Experience (years)" error={e.experienceYears?.message}><Input type="number" min={0} {...form.register('experienceYears')} placeholder={PLACEHOLDERS.EXPERIENCE_YEARS} /></Field>
                  </FormGroup>

                  <FormGroup icon={<KeyRound />} title="Login & access">
                    <Field label="Username" error={e.username?.message} hint="For login, e.g. ravi.k"><Input autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.USERNAME_MAX} {...form.register('username')} placeholder={PLACEHOLDERS.USERNAME} /></Field>
                    <Field label={editing === 'new' ? 'Password' : 'New password'} error={e.password?.message} hint={editing === 'new' ? 'Min 8 chars, letter + number' : 'Leave empty to keep the current one'}><Input type="password" autoComplete="new-password" {...form.register('password')} placeholder={PLACEHOLDERS.NEW_PASSWORD} /></Field>
                    <Field label="Account status"><NativeSelect {...form.register('status')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></NativeSelect></Field>
                    <Field label="Roles" required error={e.roleCodes?.message} className="sm:col-span-3" hint="Technician / Staff makes them a field technician who can be assigned jobs.">
                      <Controller control={form.control} name="roleCodes" render={({ field }) => (
                        <MultiSelectDropdown
                          placeholder="Select roles"
                          invalid={!!e.roleCodes}
                          options={(roles ?? []).filter((r) => r.code !== 'CUSTOMER' && (r.code !== 'SUPER_ADMIN' || user?.isSuperAdmin)).map((r) => ({ id: r.id, name: r.name, hint: r.code }))}
                          value={(roles ?? []).filter((r) => field.value.includes(r.code)).map((r) => r.id)}
                          onChange={(ids) => field.onChange((roles ?? []).filter((r) => ids.includes(r.id)).map((r) => r.code))}
                        />
                      )} />
                    </Field>
                  </FormGroup>

                  <FormGroup icon={<Building2 />} title="Work">
                    <Field label="Branch" required error={e.branchId?.message}>
                      <NativeSelect searchable {...form.register('branchId')} disabled={!user?.isCompanyWide}>
                        <option value={0}>Select branch</option>
                        {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label="Shift start" error={e.workStartTime?.message}><Input type="time" {...form.register('workStartTime')} /></Field>
                    <Field label="Shift end" error={e.workEndTime?.message}><Input type="time" {...form.register('workEndTime')} /></Field>
                    {isTechnicianRole && (
                      <Controller control={form.control} name="isAvailable" render={({ field }) => (
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 sm:col-span-3">
                          <span>
                            <span className="block text-[13.5px] font-semibold text-brand-navy">Available for jobs</span>
                            <span className="block text-xs text-muted-foreground">Turn off when on leave — they stop getting new assignments.</span>
                          </span>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </label>
                      )} />
                    )}
                  </FormGroup>
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
              {tab === 'profile' && (
                <>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    Save & next <ArrowRight />
                  </Button>
                </>
              )}
              {tab === 'work' && (
                <>
                  <Button type="button" variant="outline" onClick={() => setTab('profile')}><ArrowLeft /> Back</Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    <HardHat /> Save staff
                  </Button>
                </>
              )}
              {tab === 'history' && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Close</Button>}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.user.name}?`}
        description={`Their login is disabled and they are signed out everywhere. ${ROW_ACTIONS.ARCHIVE_NOTE}`}
        confirmLabel={ROW_ACTIONS.DELETE}
        destructive
        loading={actions.remove.isPending}
        onConfirm={() => toDelete && actions.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </>
  );
}

/** Titled block inside the staff form: small icon heading, then a responsive 3-column grid. */
const FormGroup = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section>
    <h4 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-brand-blue">
      {icon}
      {title}
    </h4>
    <div className="grid gap-4 sm:grid-cols-3">{children}</div>
  </section>
);
