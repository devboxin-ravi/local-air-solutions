/**
 * Dashboard KPIs, analytical reports and global search. All numbers are computed
 * from the database; trends are only reported when a prior period exists.
 */

import { Prisma } from '@prisma/client';
import { ACTIVE_JOB_STATUSES, PENDING_BOOKING_STATUSES } from '../constants';
import { ReportRepository, DateRange } from '../repositories/reportRepository';
import type { AuthUser } from '../models';
import { moneyNumber, parseDateOnly, todayDateOnly, addDays, formatDisplayDate } from '../utils/helpers';
import { customerBranchWhere, resolveBranchScope } from './accessControl';

const DASHBOARD_LIST_SIZE = 6;
const SEARCH_LIMIT = 5;
const CUSTOMER_REPORT_LIMIT = 500;
const CANCELLATION_REPORT_LIMIT = 500;

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Percentage change; null when there is no previous data to compare (never invented). */
const trend = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

export interface ReportFilter {
  from?: string;
  to?: string;
  branchId?: number;
  granularity?: 'day' | 'month';
}

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  private range(f: ReportFilter, defaultDays = 365): DateRange {
    const to = f.to ? new Date(`${f.to}T23:59:59.999Z`) : new Date();
    const from = f.from ? parseDateOnly(f.from) : addDays(todayDateOnly(), -defaultDays);
    return { from, to };
  }

  async dashboard(actor: AuthUser, f: ReportFilter) {
    const branchId = resolveBranchScope(actor, f.branchId);
    const b = branchId ? { branchId } : {};
    const today = todayDateOnly();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const range = this.range(f, 180);

    const [
      totalBookings,
      todaysBookings,
      pendingJobs,
      activeJobs,
      completedJobs,
      activeTechnicians,
      totalCustomers,
      monthRevenue,
      prevMonthRevenue,
      outstanding,
      bookingsThisMonth,
      bookingsPrevMonth,
      statusDist,
      revenueSeries,
      collectionSeries,
      bookingSeries,
      categoryDist,
      branchPerf,
      techPerf,
      recentBookings,
      recentPayments,
      recentAssignments,
      upcoming,
      pendingVerifications,
      unassigned,
      expiringAmc,
    ] = await Promise.all([
      this.repo.countBookings({ ...b }),
      this.repo.countBookings({ ...b, scheduledDate: today }),
      this.repo.countBookings({ ...b, status: { in: PENDING_BOOKING_STATUSES } }),
      this.repo.countBookings({ ...b, status: { in: ACTIVE_JOB_STATUSES } }),
      this.repo.countBookings({ ...b, status: 'COMPLETED' }),
      this.repo.countActiveTechnicians(branchId),
      this.repo.countCustomers({ deletedAt: null, ...customerBranchWhere(branchId) }),
      this.repo.sumInvoices({ ...b, invoiceDate: { gte: monthStart } }),
      this.repo.sumInvoices({ ...b, invoiceDate: { gte: prevMonthStart, lt: monthStart } }),
      this.repo.sumInvoices({ ...b, balanceDue: { gt: 0 } }),
      this.repo.countBookings({ ...b, createdAt: { gte: monthStart } }),
      this.repo.countBookings({ ...b, createdAt: { gte: prevMonthStart, lt: monthStart } }),
      this.repo.bookingStatusDistribution({ ...b, createdAt: { gte: range.from, lte: range.to } }),
      this.repo.monthlyRevenue(range, branchId),
      this.repo.monthlyCollections(range, branchId),
      this.repo.bookingTrend(range, branchId, f.granularity ?? 'month'),
      this.repo.categoryDistribution(range, branchId),
      branchId ? Promise.resolve([]) : this.repo.branchPerformance(range),
      this.repo.technicianPerformance(range, branchId),
      this.repo.recentBookings({ ...b }, DASHBOARD_LIST_SIZE),
      this.repo.recentPayments(branchId ? { customer: customerBranchWhere(branchId) } : {}, DASHBOARD_LIST_SIZE),
      this.repo.recentAssignments(branchId ? { booking: { branchId } } : {}, DASHBOARD_LIST_SIZE),
      this.repo.upcomingAppointments({ ...b, scheduledDate: { gte: today }, status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } }, DASHBOARD_LIST_SIZE),
      this.repo.countPayments({ status: 'PENDING_VERIFICATION', ...(branchId ? { customer: customerBranchWhere(branchId) } : {}) }),
      this.repo.countBookings({ ...b, status: { in: ['CONFIRMED', 'RESCHEDULED'] }, assignments: { none: { isCurrent: true } } }),
      this.repo.countAmc({ ...b, status: 'EXPIRING' }),
    ]);

    const monthRev = moneyNumber(monthRevenue._sum.grandTotal);
    const prevRev = moneyNumber(prevMonthRevenue._sum.grandTotal);
    const revenueMap = new Map(revenueSeries.map((r) => [r.month, moneyNumber(r.revenue)]));
    const collectionMap = new Map(collectionSeries.map((r) => [r.month, moneyNumber(r.collected)]));
    const months = Array.from(new Set([...revenueMap.keys(), ...collectionMap.keys()])).sort();

    return {
      kpis: {
        totalBookings,
        todaysBookings,
        pendingJobs,
        activeJobs,
        completedJobs,
        activeTechnicians,
        totalCustomers,
        monthlyRevenue: monthRev,
        monthlyRevenueTrend: trend(monthRev, prevRev),
        outstandingPayments: moneyNumber(outstanding._sum.balanceDue),
        bookingsThisMonth,
        bookingsTrend: trend(bookingsThisMonth, bookingsPrevMonth),
      },
      charts: {
        revenue: months.map((m) => ({ month: m, revenue: revenueMap.get(m) ?? 0, collected: collectionMap.get(m) ?? 0 })),
        bookingTrend: bookingSeries.map((r) => ({ period: r.period, total: n(r.total), completed: n(r.completed), cancelled: n(r.cancelled) })),
        categoryDistribution: categoryDist.map((r) => ({ category: r.category, bookings: n(r.bookings), revenue: moneyNumber(r.revenue) })),
        statusDistribution: statusDist.map((r) => ({ status: r.status, count: r._count._all })),
        branchPerformance: branchPerf.map((r) => ({ branchId: r.branchId, branch: r.branch, bookings: n(r.bookings), completed: n(r.completed), revenue: moneyNumber(r.revenue), collected: moneyNumber(r.collected) })),
        technicianPerformance: techPerf.slice(0, 8).map((r) => ({ staffId: r.staffId, name: r.name, assigned: n(r.assigned), completed: n(r.completed), rejected: n(r.rejected) })),
      },
      lists: { recentBookings, recentPayments, recentAssignments, upcoming },
      pendingActions: { paymentVerifications: pendingVerifications, unassignedBookings: unassigned, expiringAmc },
    };
  }

  // ─── Reports (rows are plain objects suitable for export) ───
  async cancellationReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.cancelledBookings(this.range(f), resolveBranchScope(actor, f.branchId), CANCELLATION_REPORT_LIMIT);
    return rows.map((r) => ({
      bookingNumber: r.bookingNumber,
      cancelledOn: r.statusHistory[0] ? formatDisplayDate(r.statusHistory[0].createdAt) : '',
      customer: r.customer.fullName,
      mobile: r.customer.mobile,
      service: r.items.map((i) => i.serviceName).join(', ') || r.problemDescription || '',
      branch: r.branch.name,
      status: r.status,
      reason: r.cancelReason ?? r.statusHistory[0]?.note ?? '',
    }));
  }

  async bookingReport(actor: AuthUser, f: ReportFilter) {
    const branchId = resolveBranchScope(actor, f.branchId);
    const rows = await this.repo.bookingTrend(this.range(f), branchId, f.granularity ?? 'day');
    return rows.map((r) => ({ period: r.period, total: n(r.total), completed: n(r.completed), cancelled: n(r.cancelled) }));
  }

  async revenueReport(actor: AuthUser, f: ReportFilter) {
    const branchId = resolveBranchScope(actor, f.branchId);
    const range = this.range(f);
    const [rev, col] = await Promise.all([this.repo.monthlyRevenue(range, branchId), this.repo.monthlyCollections(range, branchId)]);
    const colMap = new Map(col.map((c) => [c.month, moneyNumber(c.collected)]));
    return rev.map((r) => ({ month: r.month, invoices: n(r.invoices), billed: moneyNumber(r.revenue), collected: colMap.get(r.month) ?? 0 }));
  }

  async serviceReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.serviceWise(this.range(f), resolveBranchScope(actor, f.branchId));
    return rows.map((r) => ({ service: r.service, code: r.code, bookings: n(r.bookings), completed: n(r.completed), revenue: moneyNumber(r.revenue) }));
  }

  async staffReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.technicianPerformance(this.range(f), resolveBranchScope(actor, f.branchId));
    return rows.map((r) => ({
      staffCode: r.staffCode,
      name: r.name,
      assigned: n(r.assigned),
      completed: n(r.completed),
      rejected: n(r.rejected),
      completionRate: n(r.assigned) ? Math.round((n(r.completed) / n(r.assigned)) * 1000) / 10 : 0,
      revenue: moneyNumber(r.revenue),
    }));
  }

  async branchReport(actor: AuthUser, f: ReportFilter) {
    const scope = resolveBranchScope(actor, f.branchId);
    const rows = await this.repo.branchPerformance(this.range(f));
    return rows
      .filter((r) => !scope || r.branchId === scope)
      .map((r) => ({ branch: r.branch, bookings: n(r.bookings), completed: n(r.completed), revenue: moneyNumber(r.revenue), collected: moneyNumber(r.collected) }));
  }

  async customerReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.customerReport(this.range(f), resolveBranchScope(actor, f.branchId), CUSTOMER_REPORT_LIMIT);
    return rows.map((r) => ({ code: r.code, name: r.name, mobile: r.mobile, bookings: n(r.bookings), billed: moneyNumber(r.billed), paid: moneyNumber(r.paid) }));
  }

  async gstReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.gstReport(this.range(f), resolveBranchScope(actor, f.branchId));
    return rows.map((r) => ({ month: r.month, invoices: n(r.invoices), taxable: moneyNumber(r.taxable), cgst: moneyNumber(r.cgst), sgst: moneyNumber(r.sgst), igst: moneyNumber(r.igst), total: moneyNumber(r.total) }));
  }

  async paymentReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.paymentMethodSplit(this.range(f), resolveBranchScope(actor, f.branchId));
    return rows.map((r) => ({ method: r.method, account: r.account ?? '-', status: r.status, count: n(r.count), amount: moneyNumber(r.amount), charges: moneyNumber(r.charges) }));
  }

  async amcReport(actor: AuthUser, f: ReportFilter) {
    const rows = await this.repo.amcSummary(resolveBranchScope(actor, f.branchId));
    return rows.map((r) => ({ status: r.status, contracts: r._count._all, value: moneyNumber(r._sum.contractAmount) }));
  }

  async financeSummary(actor: AuthUser, f: ReportFilter) {
    const branchId = resolveBranchScope(actor, f.branchId);
    const range = this.range(f);
    const b: Prisma.InvoiceWhereInput = branchId ? { branchId } : {};
    const [all, period, payments, gst] = await Promise.all([
      this.repo.sumInvoices(b),
      this.repo.sumInvoices({ ...b, invoiceDate: { gte: range.from, lte: range.to } }),
      this.repo.sumVerifiedPayments({ ...(branchId ? { customer: customerBranchWhere(branchId) } : {}), receivedAt: { gte: range.from, lte: range.to } }),
      this.repo.gstReport(range, branchId),
    ]);
    return {
      totalRevenue: moneyNumber(all._sum.grandTotal),
      paymentsReceived: moneyNumber(payments._sum.amount),
      pendingPayments: moneyNumber(all._sum.balanceDue),
      outstandingBalance: moneyNumber(all._sum.balanceDue),
      periodRevenue: moneyNumber(period._sum.grandTotal),
      periodInvoices: period._count._all,
      gstSummary: {
        taxable: moneyNumber(period._sum.taxableAmount),
        cgst: moneyNumber(period._sum.cgst),
        sgst: moneyNumber(period._sum.sgst),
        igst: moneyNumber(period._sum.igst),
        total: moneyNumber(period._sum.gstTotal),
      },
      gstMonthly: gst.map((r) => ({ month: r.month, taxable: moneyNumber(r.taxable), gst: moneyNumber(r.cgst) + moneyNumber(r.sgst) + moneyNumber(r.igst) })),
    };
  }

  globalSearch(actor: AuthUser, q: string, branchId?: number) {
    return this.repo.globalSearch(q, resolveBranchScope(actor, branchId), SEARCH_LIMIT);
  }
}
