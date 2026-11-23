/**
 * Customer create/edit form logic including first address and duplicate-mobile acknowledgement.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/services/apiClient';
import { ROUTES } from '@/constants/routes';
import { addressSchema, customerSchema, emptyToNull } from '@/lib/validation';
import { errorMessage, fieldErrors, useCities, useStates } from './useApi';
import { useCustomer, useCustomerActions } from './usePeople';

const createSchema = customerSchema.extend({ address: addressSchema });
export type CustomerCreateForm = z.infer<typeof createSchema>;

export function useCustomerForm(id?: number) {
  const navigate = useNavigate();
  const existing = useCustomer(id);
  const actions = useCustomerActions();
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CustomerCreateForm>({
    resolver: zodResolver(id ? customerSchema.extend({ address: addressSchema.partial().optional() }) : createSchema) as never,
    defaultValues: {
      fullName: '',
      mobile: '',
      email: '',
      alternateMobile: '',
      branchId: '',
      customerType: 'INDIVIDUAL',
      status: 'ACTIVE',
      notes: '',
      reminderIntervalMonths: '',
      address: { label: 'Home', line1: '', line2: '', landmark: '', stateId: '' as never, cityId: '' as never, pincode: '', latitude: '', longitude: '' },
    },
  });
  const stateId = form.watch('address.stateId');
  const states = useStates();
  const cities = useCities(stateId || undefined);

  useEffect(() => {
    const c = existing.data;
    if (c)
      form.reset({
        fullName: c.fullName,
        mobile: c.mobile,
        email: c.email ?? '',
        alternateMobile: c.alternateMobile ?? '',
        branchId: c.branchId ?? '',
        customerType: c.customerType,
        status: c.status,
        notes: c.notes ?? '',
        reminderIntervalMonths: c.reminderIntervalMonths ?? '',
      } as CustomerCreateForm);
  }, [existing.data, form]);

  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    const { address, ...rest } = v;
    const base = emptyToNull(rest as Record<string, unknown>);
    try {
      if (id) {
        await actions.update.mutateAsync({ id, body: base });
        navigate(ROUTES.CUSTOMER_DETAIL(id));
      } else {
        const created = await actions.create.mutateAsync({ ...base, address: emptyToNull(address as Record<string, unknown>), allowDuplicateMobile: !!duplicateWarning });
        navigate(ROUTES.CUSTOMER_DETAIL(created.id));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_MOBILE') {
        setDuplicateWarning(err.message);
        return;
      }
      Object.entries(fieldErrors(err)).forEach(([k, m]) => form.setError(k as never, { message: m }));
      setFormError(errorMessage(err));
    }
  });

  return { form, submit, existing, states: states.data, cities: cities.data, duplicateWarning, clearDuplicate: () => setDuplicateWarning(null), formError };
}
