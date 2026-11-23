/**
 * Add/edit customer address dialog logic.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, emptyToNull, type AddressForm } from '@/lib/validation';
import type { Address } from '@/types';
import { errorMessage, fieldErrors, useCities, useStates } from './useApi';
import { useCustomerActions } from './usePeople';

const BLANK: AddressForm = { label: 'Home', line1: '', line2: '', landmark: '', stateId: '' as never, cityId: '' as never, pincode: '', latitude: '', longitude: '', isDefault: false };

export function useAddressEditor(customerId: number) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = useCustomerActions();
  const form = useForm<AddressForm>({ resolver: zodResolver(addressSchema), defaultValues: BLANK });
  const states = useStates();
  const cities = useCities(form.watch('stateId') || undefined);

  const openNew = () => {
    setEditing(null);
    setError(null);
    form.reset(BLANK);
    setOpen(true);
  };
  const openEdit = (a: Address) => {
    setEditing(a);
    setError(null);
    form.reset({
      label: a.label,
      line1: a.line1,
      line2: a.line2 ?? '',
      landmark: a.landmark ?? '',
      stateId: a.stateId,
      cityId: a.cityId,
      pincode: a.pincode,
      latitude: a.latitude ? Number(a.latitude) : '',
      longitude: a.longitude ? Number(a.longitude) : '',
      isDefault: a.isDefault,
    });
    setOpen(true);
  };

  const save = form.handleSubmit(async (v) => {
    const body = emptyToNull(v as Record<string, unknown>);
    try {
      if (editing) await actions.updateAddress.mutateAsync({ id: customerId, addressId: editing.id, body });
      else await actions.addAddress.mutateAsync({ id: customerId, body });
      setOpen(false);
    } catch (e) {
      Object.entries(fieldErrors(e)).forEach(([k, m]) => form.setError(k as keyof AddressForm, { message: m }));
      setError(errorMessage(e));
    }
  });

  return {
    open,
    setOpen,
    editing,
    form,
    states: states.data,
    cities: cities.data,
    openNew,
    openEdit,
    save,
    error,
    saving: form.formState.isSubmitting,
    remove: (addressId: number) => actions.removeAddress.mutate({ id: customerId, addressId }),
    setDefault: (addressId: number) => actions.updateAddress.mutate({ id: customerId, addressId, body: { isDefault: true } }),
  };
}
