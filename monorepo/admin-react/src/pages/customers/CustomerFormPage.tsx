/**
 * Add / edit customer.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Save } from 'lucide-react';
import { useCustomerForm } from '@/hooks/useCustomerForm';
import { useBranches } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { LIMITS } from '@/constants/ui';
import { ErrorState, Field, FormCard, FormSection, LoadingBlock, PageHeader } from '@/components/common';
import { AddressFields } from '@/components/AddressFields';
import { Button, Input, NativeSelect, Textarea } from '@/components/ui/primitives';

export default function CustomerFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: branches } = useBranches({ activeOnly: true });
  const f = useCustomerForm(id);
  const e = f.form.formState.errors;
  const reg = f.form.register;

  if (id && f.existing.isLoading) return <LoadingBlock rows={8} />;
  if (id && f.existing.error) return <ErrorState message={(f.existing.error as Error).message} />;

  return (
    <form onSubmit={f.submit} noValidate>
      <PageHeader
        title={id ? `Edit ${f.existing.data?.fullName ?? 'customer'}` : 'Add Customer'}
        description="Contact details, branch and service preferences."
        breadcrumbs={[{ label: 'Customers', to: ROUTES.CUSTOMERS }, { label: id ? 'Edit' : 'Add Customer' }]}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={f.form.formState.isSubmitting}>
              <Save /> {f.duplicateWarning ? 'Create anyway' : 'Save customer'}
            </Button>
          </>
        }
      />
      {f.duplicateWarning && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13.5px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold">Possible duplicate</p>
            <p>{f.duplicateWarning} Shared family or business numbers are allowed — click “Create anyway” to continue.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={f.clearDuplicate}>
            Dismiss
          </Button>
        </div>
      )}
      {f.formError && (
        <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
          {f.formError}
        </p>
      )}
      <FormCard
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={f.form.formState.isSubmitting}>
              <Save /> {f.duplicateWarning ? 'Create anyway' : 'Save customer'}
            </Button>
          </>
        }
      >
        <FormSection step={1} title="Personal information" description="Contact details, branch and service preferences.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={e.fullName?.message} className="sm:col-span-2">
              <Input {...reg('fullName')} maxLength={LIMITS.NAME_MAX} aria-invalid={!!e.fullName} />
            </Field>
            <Field label="Mobile number" required error={e.mobile?.message} hint="10 digits, +91 is stored separately">
              <div className="flex">
                <span className="flex items-center rounded-l-lg border border-r-0 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
                <Input {...reg('mobile')} inputMode="numeric" maxLength={10} className="rounded-l-none" aria-invalid={!!e.mobile} />
              </div>
            </Field>
            <Field label="Alternate contact" error={e.alternateMobile?.message}>
              <Input {...reg('alternateMobile')} inputMode="numeric" maxLength={10} />
            </Field>
            <Field label="Email" error={e.email?.message} className="sm:col-span-2">
              <Input type="email" {...reg('email')} maxLength={LIMITS.EMAIL_MAX} />
            </Field>
            <Field label="Customer type">
              <NativeSelect {...reg('customerType')}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="BUSINESS">Business</option>
              </NativeSelect>
            </Field>
            <Field label="Account status">
              <NativeSelect {...reg('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </NativeSelect>
            </Field>
            <Field label="Branch" hint={user?.isCompanyWide ? undefined : 'Your branch is applied automatically'}>
              <NativeSelect {...reg('branchId')} disabled={!user?.isCompanyWide}>
                <option value="">Auto (from address)</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reminder interval (months)" hint="Overrides the service default" error={e.reminderIntervalMonths?.message}>
              <Input type="number" min={1} max={36} {...reg('reminderIntervalMonths')} />
            </Field>
            <Field
              label="Notes"
              className="sm:col-span-2"
              counter={{
                value: (f.form.watch('notes') ?? '').length,
                max: LIMITS.NOTES_MAX,
              }}
            >
              <Textarea {...reg('notes')} maxLength={LIMITS.NOTES_MAX} />
            </Field>
          </div>
        </FormSection>
        {!id && (
          <FormSection step={2} title="Primary address" description="Where services happen. More addresses can be added from the customer profile.">
            <AddressFields register={reg} errors={e.address as never} prefix="address." states={f.states} cities={f.cities} />
          </FormSection>
        )}
      </FormCard>
    </form>
  );
}
