/**
 * Create / edit a service: identity, pricing & GST, reminders, skills and branch availability.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useService, useServiceActions } from '@/hooks/useCatalog';
import { fieldErrors, useBranches, useCategories, useSkills, errorMessage } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import { LIMITS, PRICING_TYPES } from '@/constants/ui';
import { emptyToNull, serviceSchema, type ServiceForm } from '@/lib/validation';
import { ErrorState, Field, LoadingBlock, PageHeader, SectionCard } from '@/components/common';
import { ChipMultiSelect } from '@/components/Pickers';
import { Button, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/primitives';
import { toast } from 'sonner';

const DEFAULTS: ServiceForm = {
  categoryId: 0,
  code: '',
  name: '',
  description: '',
  imageUrl: '',
  durationMinutes: 60,
  pricingType: 'FIXED',
  basePrice: 0,
  gstApplicable: true,
  gstRate: 18,
  reminderEligible: false,
  reminderIntervalMonths: '',
  isPopular: false,
  isActive: true,
  skillIds: [],
  branchIds: [],
};

export default function ServiceFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const existing = useService(id);
  const { data: categories } = useCategories();
  const { data: skills } = useSkills();
  const { data: branches } = useBranches();
  const actions = useServiceActions();
  const form = useForm<ServiceForm>({ resolver: zodResolver(serviceSchema), defaultValues: DEFAULTS });
  const e = form.formState.errors;
  const pricingType = form.watch('pricingType');
  const gstApplicable = form.watch('gstApplicable');
  const reminderEligible = form.watch('reminderEligible');

  useEffect(() => {
    const s = existing.data;
    if (s)
      form.reset({
        categoryId: s.categoryId,
        code: s.code,
        name: s.name,
        description: s.description ?? '',
        imageUrl: s.imageUrl ?? '',
        durationMinutes: s.durationMinutes,
        pricingType: s.pricingType,
        basePrice: s.basePrice,
        gstApplicable: s.gstApplicable,
        gstRate: s.gstRate,
        reminderEligible: s.reminderEligible,
        reminderIntervalMonths: s.reminderIntervalMonths ?? '',
        isPopular: s.isPopular,
        isActive: s.isActive,
        skillIds: s.skills.map((k) => k.id),
        branchIds: s.branches.map((b) => b.id),
      });
  }, [existing.data, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    const body = emptyToNull({ ...v, basePrice: v.pricingType === 'FREE' || v.pricingType === 'QUOTATION' ? 0 : v.basePrice });
    try {
      if (id) await actions.update.mutateAsync({ id, body });
      else await actions.create.mutateAsync(body);
      navigate(ROUTES.SERVICES);
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) => form.setError(k as keyof ServiceForm, { message: m }));
      toast.error(errorMessage(err));
    }
  });

  if (id && existing.isLoading) return <LoadingBlock rows={8} />;
  if (id && existing.error) return <ErrorState message={(existing.error as Error).message} onRetry={() => existing.refetch()} />;

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={id ? `Edit ${existing.data?.name ?? 'service'}` : 'Add Service'}
        description="Services are fetched by the apps from here — no code changes needed."
        breadcrumbs={[{ label: 'Services', to: ROUTES.SERVICES }, { label: id ? 'Edit' : 'Add Service' }]}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SERVICES)}>Cancel</Button>
            <Button type="submit" loading={form.formState.isSubmitting}><Save /> Save service</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <SectionCard title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service name" required error={e.name?.message}><Input {...form.register('name')} maxLength={LIMITS.NAME_MAX} aria-invalid={!!e.name} /></Field>
              <Field label="Service code" required error={e.code?.message} hint="Unique, e.g. AC-GEN-SVC"><Input {...form.register('code')} className="uppercase" maxLength={30} aria-invalid={!!e.code} /></Field>
              <Field label="Category" required error={e.categoryId?.message}>
                <NativeSelect {...form.register('categoryId')} aria-invalid={!!e.categoryId}>
                  <option value={0}>Select category</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Estimated duration (minutes)" required error={e.durationMinutes?.message}><Input type="number" min={10} step={5} {...form.register('durationMinutes')} /></Field>
              <Field label="Description" className="sm:col-span-2" error={e.description?.message} counter={{ value: (form.watch('description') ?? '').length, max: LIMITS.DESCRIPTION_MAX }}>
                <Textarea {...form.register('description')} maxLength={LIMITS.DESCRIPTION_MAX} />
              </Field>
              <Field label="Image URL" className="sm:col-span-2" error={e.imageUrl?.message} hint="Optional HTTPS image shown in the customer app"><Input {...form.register('imageUrl')} placeholder="https://…" /></Field>
            </div>
          </SectionCard>

          <SectionCard title="Pricing & tax" description="Changing the price never alters existing bookings or invoices.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pricing type" required>
                <NativeSelect {...form.register('pricingType')}>{PRICING_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect>
              </Field>
              <Field label="Base price (₹)" required={pricingType === 'FIXED' || pricingType === 'STARTING'} error={e.basePrice?.message}>
                <Input type="number" step="0.01" min="0" disabled={pricingType === 'FREE' || pricingType === 'QUOTATION'} {...form.register('basePrice')} aria-invalid={!!e.basePrice} />
              </Field>
              <ToggleRow control={form.control} name="gstApplicable" label="GST applicable" />
              <Field label="GST rate (%)" error={e.gstRate?.message}>
                <NativeSelect {...form.register('gstRate')} disabled={!gstApplicable}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</NativeSelect>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Required technician skills" description="Used to suggest the right technician.">
            <Controller control={form.control} name="skillIds" render={({ field }) => <ChipMultiSelect options={skills ?? []} value={field.value} onChange={field.onChange} emptyText="Add skills in Master Data first." />} />
          </SectionCard>

          <SectionCard title="Branch availability" description="Leave empty to offer this service in every branch.">
            <Controller control={form.control} name="branchIds" render={({ field }) => <ChipMultiSelect options={branches ?? []} value={field.value} onChange={field.onChange} emptyText="No branches yet." />} />
          </SectionCard>
        </div>
        <div className="space-y-6 xl:sticky xl:top-36 xl:self-start">
          <SectionCard title="Visibility">
            <div className="space-y-4">
              <ToggleRow control={form.control} name="isActive" label="Active" hint="Inactive services are hidden from booking" />
              <ToggleRow control={form.control} name="isPopular" label="Popular service" hint="Highlighted on the customer home screen" />
            </div>
          </SectionCard>
          <SectionCard title="Service reminders">
            <div className="space-y-4">
              <ToggleRow control={form.control} name="reminderEligible" label="Create reminder after completion" />
              <Field label="Interval (months)" hint="Empty = company default (6 months)" error={e.reminderIntervalMonths?.message}>
                <Input type="number" min={1} max={36} disabled={!reminderEligible} {...form.register('reminderIntervalMonths')} />
              </Field>
            </div>
          </SectionCard>
        </div>
      </div>
    </form>
  );
}

const ToggleRow = ({ control, name, label, hint }: { control: ReturnType<typeof useForm<ServiceForm>>['control']; name: 'gstApplicable' | 'isActive' | 'isPopular' | 'reminderEligible'; label: string; hint?: string }) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
        <div>
          <Label>{label}</Label>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
      </div>
    )}
  />
);
