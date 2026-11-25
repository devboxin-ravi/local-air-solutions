/**
 * API-related constants: versioning, status codes, pagination, upload rules.
 */

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
export const DOCS_PATH = '/api/docs';
export const UPLOADS_PUBLIC_PATH = '/uploads';

export enum StatusCodes {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE = 422,
  LOCKED = 423,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  EXPORT_MAX_ROWS: 10000,
} as const;

export const UploadRules = {
  IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as string[],
  MEDIA_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'] as string[],
  MAX_FILES_PER_REQUEST: 6,
  /** Folder (under UPLOAD_DIR) for profile pictures. */
  AVATAR_FOLDER: 'avatars',
  AVATAR_FIELD: 'file',
  /** Folder (under UPLOAD_DIR) for service / category photos managed from the admin panel. */
  CATALOG_FOLDER: 'catalog',
  CATALOG_FIELD: 'file',
} as const;

/** Which client a sign-in came from; admin-panel sessions have a fixed lifetime. */
export const AuthClients = { ADMIN_PANEL: 'ADMIN_PANEL', APP: 'APP' } as const;
export type AuthClient = (typeof AuthClients)[keyof typeof AuthClients];
/** Refresh-token family id prefix that marks an admin-panel session. */
export const ADMIN_SESSION_FAMILY_PREFIX = 'adm_';

export const HeaderNames = {
  IDEMPOTENCY_KEY: 'idempotency-key',
  RAZORPAY_SIGNATURE: 'x-razorpay-signature',
} as const;
