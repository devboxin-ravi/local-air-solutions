/**
 * Validation limits shared by all request schemas.
 */

export const Limits = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  DESCRIPTION_MAX: 2000,
  NOTES_MAX: 1000,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  CODE_MAX: 30,
  SEARCH_MAX: 100,
  AMOUNT_MAX: 99_999_999.99,
  GST_RATE_MAX: 28,
} as const;

export const Patterns = {
  /** Indian mobile: 10 digits starting 6-9. Country code is stored separately. */
  INDIAN_MOBILE: /^[6-9]\d{9}$/,
  PINCODE: /^[1-9]\d{5}$/,
  /** Login username: starts with a letter; lowercase letters, digits, dot, underscore (never a mobile/email). */
  USERNAME: /^[a-z][a-z0-9._]{2,29}$/,
  TIME_HHMM: /^([01]\d|2[0-3]):[0-5]\d$/,
  /** At least one letter and one digit. */
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).+$/,
  SERVICE_CODE: /^[A-Z0-9-]+$/,
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  COUNTRY_CODE: /^\+\d{1,4}$/,
  GST_STATE_CODE: /^\d{2}$/,
  SAC_CODE: /^\d{4,8}$/,
  UPI_ID: /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/,
} as const;

export const ValidationMessages = {
  MOBILE: 'Enter a valid 10-digit Indian mobile number',
  PINCODE: 'Enter a valid 6-digit PIN code',
  USERNAME: 'Username: 3-30 lowercase letters, numbers, dot or underscore, starting with a letter',
  PASSWORD: 'Password must be at least 8 characters and include a letter and a number',
  TIME: 'Use HH:mm format',
  GSTIN: 'Enter a valid 15-character GSTIN',
  SERVICE_CODE: 'Use uppercase letters, numbers and hyphens only',
  END_AFTER_START: 'End must be after start',
  GST_STATE_CODE: 'Use the 2-digit GST state code',
  SAC_CODE: 'SAC code is 4 to 8 digits',
  UPI_ID: 'Enter a valid UPI ID, e.g. name@bank',
  GST_RATE: 'Choose 0, 5, 12, 18 or 28%',
} as const;
