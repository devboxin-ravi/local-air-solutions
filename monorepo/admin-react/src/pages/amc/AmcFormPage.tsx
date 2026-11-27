/**
 * Create AMC: customer, address, covered services, period, visits and amount.
 */

import { useEffect, useState } from 'react';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addMonths, addDays } from 'date-fns';
import { Save } from 'lucide-react';
import { useAmcActions } from '@/hooks/useFinance';
import { useCustomer, useCustomerSearch } from '@/hooks/usePeople';
import { useBranches, useServiceLookup } from '@/hooks/useApi';
import { ROUTES } from '@/constants/routes';
import { formatMoney, toYmd } from '@/lib/utils';
import { amcSchema, emptyToNull, type AmcForm } from '@/lib/validation';
import type { Customer } from '@/types';
import { Field, FormCard, FormSection, PageHeader } from '@/components/common';
import { ChipMultiSelect, CustomerPicker } from '@/components/Pickers';
import { Button, Checkbox, Input, Label, NativeSelect, Textarea } from '@/components/ui/primitives';
import { PLACEHOLDERS } from '@/constants/ui';
import { useGoBack } from '@/hooks/useGoBack';

const today = new Date();

export default function AmcFormPage() {
  const goBack = useGoBack(ROUTES.AMC);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = useCustomer(params.get('customerId') ? Number(params.get('customerId')) : undefined);
  const [search, setSearch] = useState('');
  const results = useCustomerSearch(search);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const selected = customer ?? preset.data ?? null;
  const { data: branches } = useBranches({ activeOnly: true });
  const actions = useAmcActions();
  const { branchId: scopeBranchId } = useBranchScope();

  const form = useForm<AmcForm>({
    resolver: zodResolver(amcSchema),
    defaultValues: {
      customerId: 0,
      addressId: 0,
      branchId: scopeBranchId ?? 0,
      productDetails: '',
      serviceIds: [],
      startDate: toYmd(today),
      endDate: toYmd(addDays(addMonths(today, 12), -1)),
      totalVisits: 4,
      visitFrequencyMonths: 3,
      contractAmount: 0,
      applyGst: true,
      terms: 'Covers periodic servicing as listed. Spare parts and gas refilling are chargeable unless stated. Visits must be scheduled within the contract period.',
    },
  });
  const e = form.formState.errors;
  // Services offered in (and priced for) the contract's branch.
  const contractBranchId = Number(form.watch('branchId')) || undefined;
  const { data: services } = useServiceLookup(contractBranchId);

  useEffect(() => {
    if (!selected) return;
    const addr = selected.addresses.find((a) => a.isDefault) ?? selected.addresses[0];
    form.setValue('customerId', selected.id);
    if (addr) form.setValue('addressId', addr.id);
    const branchId = addr?.serviceArea?.branchId ?? selected.branchId;
    if (branchId) form.setValue('branchId', branchId);
  }, [selected, form]);

  const onSubmit = form.handleSubmit((v) =>
    actions.create.mutate(emptyToNull(v as Record<string, unknown>), {
      onSuccess: (a) => navigate(ROUTES.AMC_DETAIL(a.id)),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader onBack={goBack}
        title="Create AMC"
        description="Contracts start as drafts. Issue the invoice, record payment, and the AMC activates with visits scheduled automatically."
        breadcrumbs={[{ label: 'AMC', to: ROUTES.AMC }, { label: 'Create AMC' }]}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.AMC)}>
              Cancel
            </Button>
            <Button type="submit" loading={actions.create.isPending}>
              <Save /> Save draft
            </Button>
          </>
        }
      />
      <FormCard
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.AMC)}>
              Cancel
            </Button>
            <Button type="submit" loading={actions.create.isPending}>
              <Save /> Save draft
            </Button>
          </>
        }
      >
        <FormSection step={1} title="Customer" description="Who the contract is for, the service address and branch.">
          <div className="space-y-4">
            <Field label="Customer" required error={e.customerId?.message}>
              <CustomerPicker value={selected} options={results.data ?? []} loading={results.isFetching} search={search} onSearchChange={setSearch} onSelect={setCustomer} invalid={!!e.customerId} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service address" required error={e.addressId?.message}>
                <NativeSelect searchable {...form.register('addressId')} disabled={!selected}>
                  <option value={0}>Select address</option>
                  {selected?.addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.line1}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Branch" required error={e.branchId?.message}>
                <NativeSelect searchable {...form.register('branchId')}>
                  <option value={0}>Select branch</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Product details" required error={e.productDetails?.message} hint="e.g. 2 × Split AC 1.5 Ton (Daikin), 1 × Window AC">
              <Textarea {...form.register('productDetails')} placeholder={PLACEHOLDERS.PRODUCT_DETAILS} maxLength={1000} className="min-h-[64px]" />
            </Field>
          </div>
        </FormSection>
        <FormSection step={2} title="Contract terms" description="Duration, number of visits and contract value.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required error={e.startDate?.message}>
              <Input type="date" {...form.register('startDate')} />
            </Field>
            <Field label="End date" required error={e.endDate?.message}>
              <Input type="date" {...form.register('endDate')} />
            </Field>
            <Field label="Number of visits" required error={e.totalVisits?.message}>
              <Input type="number" min={1} max={52} {...form.register('totalVisits')} placeholder={PLACEHOLDERS.VISITS} />
            </Field>
            <Field label="Visit every (months)" required error={e.visitFrequencyMonths?.message}>
              <Input type="number" min={1} max={12} {...form.register('visitFrequencyMonths')} placeholder={PLACEHOLDERS.MONTHS} />
            </Field>
            <Field label="Contract amount (₹)" required error={e.contractAmount?.message} hint={`Before GST · ${formatMoney(form.watch('contractAmount'))}`}>
              <Input type="number" min={0} step="0.01" {...form.register('contractAmount')} placeholder={PLACEHOLDERS.AMOUNT} />
            </Field>
            <Controller
              control={form.control}
              name="applyGst"
              render={({ field }) => (
                <label className="flex items-center gap-2.5 self-end rounded-lg border px-3 py-2.5">
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                  <Label>Apply GST on AMC invoice</Label>
                </label>
              )}
            />
          </div>
        </FormSection>
        <FormSection step={3} title="Covered services" description="Services included in every scheduled visit.">
          <Field error={e.serviceIds?.message}>
            <Controller control={form.control} name="serviceIds" render={({ field }) => <ChipMultiSelect options={services ?? []} value={field.value} onChange={field.onChange} />} />
          </Field>
        </FormSection>
        <FormSection step={4} title="Terms & conditions" description="Printed on the contract and its invoice.">
          <Textarea {...form.register('terms')} placeholder={PLACEHOLDERS.CONTRACT_TERMS} maxLength={10000} className="min-h-[120px]" />
        </FormSection>
      </FormCard>
    </form>
  );
}
