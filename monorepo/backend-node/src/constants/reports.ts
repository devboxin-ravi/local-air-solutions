/**
 * Report definitions: titles and export columns.
 */

export type ReportKey = 'bookings' | 'revenue' | 'services' | 'staff' | 'branches' | 'customers' | 'gst' | 'payments' | 'amc';

export const REPORT_KEYS: ReportKey[] = ['bookings', 'revenue', 'services', 'staff', 'branches', 'customers', 'gst', 'payments', 'amc'];

interface Col {
  key: string;
  header: string;
  money?: boolean;
  width?: number;
}

export const REPORT_DEFINITIONS: Record<ReportKey, { title: string; columns: Col[] }> = {
  bookings: {
    title: 'Booking Report',
    columns: [
      { key: 'period', header: 'Period' },
      { key: 'total', header: 'Total' },
      { key: 'completed', header: 'Completed' },
      { key: 'cancelled', header: 'Cancelled/Rejected' },
    ],
  },
  revenue: {
    title: 'Revenue Report',
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'invoices', header: 'Invoices' },
      { key: 'billed', header: 'Billed (₹)', money: true },
      { key: 'collected', header: 'Collected (₹)', money: true },
    ],
  },
  services: {
    title: 'Service-wise Report',
    columns: [
      { key: 'service', header: 'Service', width: 32 },
      { key: 'code', header: 'Code' },
      { key: 'bookings', header: 'Bookings' },
      { key: 'completed', header: 'Completed' },
      { key: 'revenue', header: 'Booked Value (₹)', money: true },
    ],
  },
  staff: {
    title: 'Technician Performance',
    columns: [
      { key: 'staffCode', header: 'Staff ID' },
      { key: 'name', header: 'Name', width: 24 },
      { key: 'assigned', header: 'Assigned' },
      { key: 'completed', header: 'Completed' },
      { key: 'rejected', header: 'Rejected' },
      { key: 'completionRate', header: 'Completion %' },
      { key: 'revenue', header: 'Job Value (₹)', money: true },
    ],
  },
  branches: {
    title: 'Branch Performance',
    columns: [
      { key: 'branch', header: 'Branch', width: 24 },
      { key: 'bookings', header: 'Bookings' },
      { key: 'completed', header: 'Completed' },
      { key: 'revenue', header: 'Billed (₹)', money: true },
      { key: 'collected', header: 'Collected (₹)', money: true },
    ],
  },
  customers: {
    title: 'Customer Report',
    columns: [
      { key: 'code', header: 'Customer ID' },
      { key: 'name', header: 'Name', width: 24 },
      { key: 'mobile', header: 'Mobile' },
      { key: 'bookings', header: 'Bookings' },
      { key: 'billed', header: 'Billed (₹)', money: true },
      { key: 'paid', header: 'Paid (₹)', money: true },
    ],
  },
  gst: {
    title: 'GST Report',
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'invoices', header: 'Invoices' },
      { key: 'taxable', header: 'Taxable (₹)', money: true },
      { key: 'cgst', header: 'CGST (₹)', money: true },
      { key: 'sgst', header: 'SGST (₹)', money: true },
      { key: 'igst', header: 'IGST (₹)', money: true },
      { key: 'total', header: 'Invoice Total (₹)', money: true },
    ],
  },
  payments: {
    title: 'Payment Report',
    columns: [
      { key: 'method', header: 'Method' },
      { key: 'status', header: 'Status' },
      { key: 'count', header: 'Count' },
      { key: 'amount', header: 'Amount (₹)', money: true },
    ],
  },
  amc: {
    title: 'AMC Report',
    columns: [
      { key: 'status', header: 'Status' },
      { key: 'contracts', header: 'Contracts' },
      { key: 'value', header: 'Contract Value (₹)', money: true },
    ],
  },
};
