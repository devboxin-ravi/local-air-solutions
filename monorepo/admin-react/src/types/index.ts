/**
 * API response and domain types (mirrors backend-node responses).
 */

export type Money = string | number;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unread?: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  mobile: string;
  userType: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  roles: string[];
  permissions: string[];
  branchId: number | null;
  isSuperAdmin: boolean;
  isCompanyWide: boolean;
  username?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export type LoginResult = { otpRequired: true; userId: number } | { otpRequired: false; tokens: TokenPair; user: AuthUser };

export interface Ref {
  id: number;
  name: string;
}

export interface State {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  _count?: { cities: number };
}
export interface City {
  id: number;
  stateId: number;
  name: string;
  isActive: boolean;
  state?: Ref;
  _count?: { branches: number };
}
export interface Branch {
  id: number;
  cityId: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  latitude: Money | null;
  longitude: Money | null;
  isActive: boolean;
  city?: { id: number; name: string; state: Ref };
  _count?: { serviceAreas: number; staff: number; customers: number };
}
export interface ServiceArea {
  id: number;
  branchId: number;
  name: string;
  pincodes: string | null;
  latitude: Money | null;
  longitude: Money | null;
  radiusKm: Money | null;
  isActive: boolean;
  branch?: Ref;
  _count?: { staff: number };
}
export interface Skill {
  id: number;
  name: string;
  isActive: boolean;
}
export interface Product {
  id: number;
  name: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { services: number };
}

export type PricingType = 'FIXED' | 'STARTING' | 'QUOTATION' | 'FREE';

export interface Service {
  id: number;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: { id: number; name: string; slug: string };
  categoryId: number;
  durationMinutes: number;
  pricingType: PricingType;
  basePrice: number;
  effectivePrice: number;
  gstApplicable: boolean;
  gstRate: number;
  reminderEligible: boolean;
  reminderIntervalMonths: number | null;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  skills: Ref[];
  branches: Ref[];
  branchPrices: Array<{ branchId: number; price: number }>;
}

export interface Address {
  id: number;
  customerId: number;
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  stateId: number;
  cityId: number;
  pincode: string;
  latitude: Money | null;
  longitude: Money | null;
  isDefault: boolean;
  state?: Ref;
  city?: Ref;
  serviceArea?: { id: number; name: string; branchId: number } | null;
  customer?: { id: number; fullName: string; customerCode: string; mobile: string };
}

export interface Customer {
  id: number;
  customerCode: string;
  fullName: string;
  countryCode: string;
  mobile: string;
  email: string | null;
  alternateMobile: string | null;
  branchId: number | null;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes: string | null;
  reminderIntervalMonths: number | null;
  createdAt: string;
  branch?: Ref | null;
  addresses: Address[];
  user?: { id: number; status: string; lastLoginAt: string | null } | null;
  _count?: { bookings: number; amcContracts: number };
}

export interface Staff {
  id: number;
  userId: number;
  staffCode: string;
  designation: string | null;
  branchId: number;
  experienceYears: number;
  workStartTime: string;
  workEndTime: string;
  isAvailable: boolean;
  isTechnician: boolean;
  activeJobs?: number;
  user: { id: number; name: string; email: string | null; username: string | null; mobile: string; countryCode: string; status: string; lastLoginAt: string | null; roles: Array<{ role: { id: number; code: string; name: string } }> };
  branch: Ref;
  skills: Array<{ skill: Ref }>;
  serviceAreas: Array<{ serviceArea: Ref }>;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ permission: Permission }>;
  _count?: { users: number };
}
export interface Permission {
  id: number;
  code: string;
  module: string;
  action: string;
}

export interface Slot {
  id: number;
  branchId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  available: number;
  isActive: boolean;
  branch?: Ref;
}

export interface BookingItem {
  id: number;
  serviceId: number;
  serviceName: string;
  serviceCode?: string;
  pricingType?: PricingType;
  quantity: number;
  unitPrice: Money;
  gstRate?: Money;
  lineTotal: Money;
  isPerformed?: boolean;
}

export interface AssignmentLite {
  id: number;
  status: string;
  isCurrent?: boolean;
  assignedAt?: string;
  respondedAt?: string | null;
  rejectReason?: string | null;
  staff: { id: number; staffCode: string; userId?: number; user: { name: string; mobile: string; countryCode?: string } };
}

export interface Booking {
  id: number;
  bookingNumber: string;
  bookingType: 'SERVICE' | 'REPAIR';
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  estimatedTotal: Money;
  problemCategory: string | null;
  problemDescription: string | null;
  instructions: string | null;
  source: string;
  createdAt: string;
  completedAt: string | null;
  cancelReason: string | null;
  branchId: number;
  customerId: number;
  addressSnapshot: { label?: string; line1?: string; line2?: string | null; landmark?: string | null; city?: string; state?: string; pincode?: string; latitude?: number | null; longitude?: number | null };
  customer: { id: number; fullName: string; mobile: string; countryCode: string; customerCode: string; email?: string | null; userId?: number | null };
  branch: Ref;
  product?: Ref | null;
  slot?: { id: number; startTime: string; endTime: string } | null;
  items: BookingItem[];
  assignments: AssignmentLite[];
  statusHistory?: Array<{ id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor?: Ref | null }>;
  notes?: Array<{ id: number; note: string; createdAt: string; author: Ref }>;
  attachments?: Array<{ id: number; kind: string; filePath: string; mimeType: string; createdAt: string }>;
  invoices?: Array<{ id: number; invoiceNumber: string; grandTotal: Money; status: string; balanceDue: Money }>;
  payments?: Array<{ id: number; paymentNumber: string; amount: Money; method: string; status: string; referenceNumber: string | null; createdAt: string }>;
  amcVisit?: { id: number; visitNumber: number; amcContract: { id: number; amcNumber: string } } | null;
}

export interface Suggestion {
  staffId: number;
  name: string;
  mobile: string;
  staffCode: string;
  score: number;
  reasons: string[];
  activeJobs: number;
  jobsOnDate: number;
  matchedSkills: string[];
  coversArea: boolean;
  isAvailable: boolean;
}

export interface Assignment {
  id: number;
  status: string;
  isCurrent: boolean;
  notes: string | null;
  rejectReason: string | null;
  assignedAt: string;
  respondedAt: string | null;
  completedAt: string | null;
  staff: { id: number; staffCode: string; user: { name: string; mobile: string } };
  booking: Booking;
}

export interface TechAvailability {
  staffId: number;
  name: string;
  staffCode: string;
  mobile: string;
  branch: Ref;
  isAvailable: boolean;
  workStartTime: string;
  workEndTime: string;
  skills: string[];
  serviceAreas: string[];
  jobsOnDate: number;
  activeJobs: number;
  jobs: Array<{ id: number; bookingNumber: string; status: string; scheduledTime: string | null; customer: string }>;
}

export interface InvoiceItem {
  id: number;
  serviceId: number | null;
  description: string;
  hsnSac: string | null;
  quantity: number;
  rate: Money;
  discount: Money;
  gstRate: Money;
  amount: Money;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: number;
  branchId: number;
  bookingId: number | null;
  amcContractId: number | null;
  subtotal: Money;
  discount: Money;
  taxableAmount: Money;
  applyGst: boolean;
  isInterState: boolean;
  cgst: Money;
  sgst: Money;
  igst: Money;
  gstTotal: Money;
  grandTotal: Money;
  amountPaid: Money;
  balanceDue: Money;
  status: string;
  isFreeService: boolean;
  notes: string | null;
  customer: { id: number; fullName: string; mobile: string; customerCode: string; email?: string | null; countryCode?: string };
  branch: Ref;
  booking?: { id: number; bookingNumber: string } | null;
  amcContract?: { id: number; amcNumber: string } | null;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface Payment {
  id: number;
  paymentNumber: string;
  customerId: number;
  method: string;
  amount: Money;
  status: string;
  referenceNumber: string | null;
  proofPath?: string | null;
  verificationNote?: string | null;
  receivedAt: string;
  createdAt?: string;
  verifiedAt?: string | null;
  customer?: { id: number; fullName: string; mobile: string; customerCode: string };
  invoice?: { id: number; invoiceNumber: string; grandTotal: Money; balanceDue: Money } | null;
  booking?: { id: number; bookingNumber: string } | null;
  amcContract?: { id: number; amcNumber: string } | null;
}

export interface LedgerEntry {
  id: number;
  entryType: string;
  referenceType: string | null;
  referenceId: number | null;
  referenceNumber: string | null;
  description: string;
  debit: Money;
  credit: Money;
  balanceAfter: Money;
  entryDate: string;
}

export interface LedgerStatement {
  customer: { id: number; fullName: string; customerCode: string; mobile: string };
  summary: { totalDebit: number; totalCredit: number; balance: number };
  items: LedgerEntry[];
  meta: PageMeta;
}

export interface AmcVisit {
  id: number;
  amcContractId: number;
  visitNumber: number;
  scheduledDate: string;
  status: string;
  completedAt: string | null;
  booking?: { id: number; bookingNumber: string; status: string } | null;
  amcContract?: { id: number; amcNumber: string; branchId: number; customer: { id: number; fullName: string; mobile: string } };
}

export interface AmcContract {
  id: number;
  amcNumber: string;
  customerId: number;
  addressId: number;
  branchId: number;
  productDetails: string;
  startDate: string;
  endDate: string;
  totalVisits: number;
  visitFrequencyMonths: number;
  contractAmount: Money;
  applyGst: boolean;
  terms: string | null;
  status: string;
  createdAt: string;
  completedVisits?: number;
  customer: { id: number; fullName: string; mobile: string; customerCode: string; email?: string | null };
  branch: Ref;
  address?: Address & { city: { name: string }; state: { name: string } };
  services?: Array<{ service: { id: number; name: string; code: string } }>;
  visits?: AmcVisit[];
  invoices?: Array<{ id: number; invoiceNumber: string; grandTotal: Money; balanceDue: Money; status: string }>;
  payments?: Array<{ id: number; paymentNumber: string; amount: Money; status: string; method: string }>;
  _count?: { visits: number };
}

export interface Reminder {
  id: number;
  customerId: number;
  type: 'SERVICE' | 'AMC';
  dueDate: string;
  status: string;
  notifyCount: number;
  lastNotifiedAt: string | null;
  note: string | null;
  customer: { id: number; fullName: string; mobile: string; countryCode: string; customerCode: string };
  service?: Ref | null;
  booking?: { id: number; bookingNumber: string } | null;
  amcContract?: { id: number; amcNumber: string } | null;
}

export interface AppNotification {
  id: number;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: Ref | null;
}

export interface Template {
  id: number;
  eventType: string;
  channel: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

export interface DashboardData {
  kpis: {
    totalBookings: number;
    todaysBookings: number;
    pendingJobs: number;
    activeJobs: number;
    completedJobs: number;
    activeTechnicians: number;
    totalCustomers: number;
    monthlyRevenue: number;
    monthlyRevenueTrend: number | null;
    outstandingPayments: number;
    bookingsThisMonth: number;
    bookingsTrend: number | null;
  };
  charts: {
    revenue: Array<{ month: string; revenue: number; collected: number }>;
    bookingTrend: Array<{ period: string; total: number; completed: number; cancelled: number }>;
    categoryDistribution: Array<{ category: string; bookings: number; revenue: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
    branchPerformance: Array<{ branchId: number; branch: string; bookings: number; completed: number; revenue: number; collected: number }>;
    technicianPerformance: Array<{ staffId: number; name: string; assigned: number; completed: number; rejected: number }>;
  };
  lists: {
    recentBookings: Array<{ id: number; bookingNumber: string; status: string; scheduledDate: string; estimatedTotal: Money; customer: { fullName: string }; items: Array<{ serviceName: string }> }>;
    recentPayments: Array<{ id: number; paymentNumber: string; amount: Money; method: string; status: string; createdAt: string; customer: { fullName: string } }>;
    recentAssignments: Array<{ id: number; status: string; assignedAt: string; booking: { id: number; bookingNumber: string }; staff: { user: { name: string } } }>;
    upcoming: Array<{ id: number; bookingNumber: string; status: string; scheduledDate: string; scheduledTime: string | null; customer: { fullName: string }; items: Array<{ serviceName: string }>; assignments: Array<{ staff: { user: { name: string } } }> }>;
  };
  pendingActions: { paymentVerifications: number; unassignedBookings: number; expiringAmc: number };
}

export interface ReportResult {
  title: string;
  columns: Array<{ key: string; header: string; money?: boolean }>;
  rows: Array<Record<string, string | number>>;
}

export interface FinanceSummary {
  totalRevenue: number;
  paymentsReceived: number;
  pendingPayments: number;
  outstandingBalance: number;
  periodRevenue: number;
  periodInvoices: number;
  gstSummary: { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  gstMonthly: Array<{ month: string; taxable: number; gst: number }>;
}

export interface SearchResults {
  bookings: Array<{ id: number; bookingNumber: string; status: string; customer: { fullName: string } }>;
  customers: Array<{ id: number; fullName: string; mobile: string; customerCode: string }>;
  invoices: Array<{ id: number; invoiceNumber: string; grandTotal: Money; status: string }>;
  services: Array<{ id: number; name: string; code: string }>;
  staff: Array<{ id: number; staffCode: string; user: { name: string } }>;
  amc: Array<{ id: number; amcNumber: string; status: string; customer: { fullName: string } }>;
}

export interface ShareLink {
  channel: 'WHATSAPP';
  url: string;
  message: string;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstTotal: number;
  grandTotal: number;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;
