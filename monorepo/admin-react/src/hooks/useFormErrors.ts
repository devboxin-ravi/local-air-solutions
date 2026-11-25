/**
 * Field-level form errors for state-based forms: validate with a Zod schema on submit,
 * map server-side field errors onto the same keys, clear a field's error as it is edited,
 * and move focus to the first invalid field. Logic only, no JSX.
 */

import { useCallback, useState } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';
import { errorMessage, fieldErrors } from './useApi';

export type FormErrors = Record<string, string>;

/** Focus the first field marked invalid by <Field> (after React has painted the errors). */
const focusFirstInvalid = () =>
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[data-invalid="true"] :is(input, select, textarea, button[aria-haspopup])');
    el?.focus({ preventScroll: false });
  });

export function useFormErrors() {
  const [errors, setErrors] = useState<FormErrors>({});

  /** Returns parsed values, or null after showing the field errors. */
  const validate = useCallback(<T>(schema: ZodType<T, ZodTypeDef, unknown>, values: unknown): T | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const next: FormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_form';
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    focusFirstInvalid();
    return null;
  }, []);

  /** Clear one field's error (call from its onChange). */
  const clear = useCallback((key: string) => {
    setErrors((e) => {
      if (!(key in e)) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  }, []);

  /**
   * Map a failed save's field errors (from the API) under their fields. The mutation itself
   * already shows the error toast. Returns the general message for inline display.
   */
  const fromServer = useCallback((err: unknown, prefix = ''): string => {
    const byField = fieldErrors(err);
    const keys = Object.keys(byField);
    if (keys.length) {
      setErrors(Object.fromEntries(keys.map((k) => [`${prefix}${k}`, byField[k]])));
      focusFirstInvalid();
    }
    return errorMessage(err);
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  return { errors, validate, clear, fromServer, reset, setErrors };
}
