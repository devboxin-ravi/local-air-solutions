/**
 * Roles, permission modules and actions (RBAC).
 * Permission codes are `${module}.${action}` e.g. `bookings.create`.
 */

export const RoleCodes = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  TECHNICIAN: 'TECHNICIAN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type RoleCode = (typeof RoleCodes)[keyof typeof RoleCodes];

/** Roles that see every branch (company-wide). */
export const COMPANY_WIDE_ROLES: string[] = [RoleCodes.SUPER_ADMIN, RoleCodes.COMPANY_ADMIN];

export const PermissionActions = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  ASSIGN: 'assign',
  MANAGE: 'manage',
} as const;
export type PermissionAction = (typeof PermissionActions)[keyof typeof PermissionActions];

export const PermissionModules = {
  DASHBOARD: 'dashboard',
  BOOKINGS: 'bookings',
  SLOTS: 'slots',
  SERVICES: 'services',
  ASSIGNMENTS: 'assignments',
  CUSTOMERS: 'customers',
  STAFF: 'staff',
  AMC: 'amc',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  LEDGER: 'ledger',
  REMINDERS: 'reminders',
  REPORTS: 'reports',
  MASTER_DATA: 'masterData',
  ROLES: 'roles',
  SETTINGS: 'settings',
  AUDIT_LOGS: 'auditLogs',
  NOTIFICATIONS: 'notifications',
} as const;
export type PermissionModule = (typeof PermissionModules)[keyof typeof PermissionModules];

/** Build a permission code. */
export const perm = (module: PermissionModule, action: PermissionAction): string => `${module}.${action}`;

/** Which actions are meaningful per module (used to seed the permission table). */
export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  dashboard: ['view'],
  bookings: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  slots: ['view', 'create', 'edit', 'delete', 'manage'],
  services: ['view', 'create', 'edit', 'delete', 'manage'],
  assignments: ['view', 'assign', 'edit'],
  customers: ['view', 'create', 'edit', 'delete', 'export'],
  staff: ['view', 'create', 'edit', 'delete'],
  amc: ['view', 'create', 'edit', 'approve', 'export'],
  invoices: ['view', 'create', 'edit', 'delete', 'export'],
  payments: ['view', 'create', 'approve', 'export'],
  ledger: ['view', 'create', 'export'],
  reminders: ['view', 'create', 'edit', 'manage'],
  reports: ['view', 'export'],
  masterData: ['view', 'create', 'edit', 'delete'],
  roles: ['view', 'manage'],
  settings: ['view', 'manage'],
  auditLogs: ['view'],
  notifications: ['view', 'manage'],
};

export const ALL_PERMISSION_CODES: string[] = Object.entries(MODULE_ACTIONS).flatMap(([m, acts]) =>
  acts.map((a) => `${m}.${a}`),
);

const BRANCH_MANAGER_EXCLUDED = [
  'roles.manage',
  'settings.manage',
  'masterData.delete',
  'auditLogs.view',
  'services.delete',
  'services.manage',
];

/** Default permissions per seeded role. SUPER_ADMIN bypasses checks entirely. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  [RoleCodes.SUPER_ADMIN]: ALL_PERMISSION_CODES,
  [RoleCodes.COMPANY_ADMIN]: ALL_PERMISSION_CODES.filter((p) => p !== 'roles.manage'),
  [RoleCodes.BRANCH_MANAGER]: ALL_PERMISSION_CODES.filter((p) => !BRANCH_MANAGER_EXCLUDED.includes(p)),
  [RoleCodes.TECHNICIAN]: [],
  [RoleCodes.CUSTOMER]: [],
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin / Owner',
  BRANCH_MANAGER: 'Branch Manager',
  TECHNICIAN: 'Technician / Staff',
  CUSTOMER: 'Customer',
};
