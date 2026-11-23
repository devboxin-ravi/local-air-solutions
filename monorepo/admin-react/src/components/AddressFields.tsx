/**
 * Address form fields (react-hook-form). UI only — state/city options are passed in.
 */

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { LIMITS } from '@/constants/ui';
import type { City, State } from '@/types';
import { Field } from './common';
import { Input, NativeSelect } from './ui/primitives';

type AddressShape = { label: string; line1: string; line2?: string; landmark?: string; stateId: number; cityId: number; pincode: string; latitude?: number | ''; longitude?: number | '' };

export function AddressFields<T extends Record<string, unknown>>({
  register,
  errors,
  prefix = '',
  states,
  cities,
  showCoordinates = true,
}: {
  register: UseFormRegister<T>;
  errors?: FieldErrors<AddressShape>;
  prefix?: string;
  states?: State[];
  cities?: City[];
  showCoordinates?: boolean;
}) {
  const r = (name: keyof AddressShape) => register(`${prefix}${String(name)}` as never);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Label" required error={errors?.label?.message} hint="Home, Office, Shop…">
        <Input {...r('label')} maxLength={50} />
      </Field>
      <Field label="PIN code" required error={errors?.pincode?.message}>
        <Input {...r('pincode')} inputMode="numeric" maxLength={6} aria-invalid={!!errors?.pincode} />
      </Field>
      <Field label="Address line 1" required className="sm:col-span-2" error={errors?.line1?.message}>
        <Input {...r('line1')} maxLength={LIMITS.ADDRESS_MAX} placeholder="House / flat no., building, street" aria-invalid={!!errors?.line1} />
      </Field>
      <Field label="Address line 2" error={errors?.line2?.message}>
        <Input {...r('line2')} maxLength={LIMITS.ADDRESS_MAX} placeholder="Area, locality" />
      </Field>
      <Field label="Landmark" error={errors?.landmark?.message}>
        <Input {...r('landmark')} maxLength={200} />
      </Field>
      <Field label="State" required error={errors?.stateId?.message}>
        <NativeSelect {...r('stateId')} aria-invalid={!!errors?.stateId}>
          <option value="">Select state</option>
          {states?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="City" required error={errors?.cityId?.message} hint={cities && !cities.length ? 'No cities for this state — add in Master Data' : undefined}>
        <NativeSelect {...r('cityId')} aria-invalid={!!errors?.cityId}>
          <option value="">Select city</option>
          {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </Field>
      {showCoordinates && (
        <>
          <Field label="Latitude" error={errors?.latitude?.message} hint="Optional — only verified coordinates">
            <Input {...r('latitude')} inputMode="decimal" placeholder="22.7196" />
          </Field>
          <Field label="Longitude" error={errors?.longitude?.message}>
            <Input {...r('longitude')} inputMode="decimal" placeholder="75.8577" />
          </Field>
        </>
      )}
    </div>
  );
}
