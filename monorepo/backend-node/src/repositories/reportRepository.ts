/**
 * Aggregate queries for dashboard, reports and global search.
 * All figures come from real data — never synthetic.
 */

import { Prisma } from '@prisma/client';
import { Db, prisma } from './db';

export interface DateRange {
  from: Date;
  to: Date;
}

const branchSql = (alias: string, branchId?: number) =>
  branchId ? Prisma.sql`AND ${Prisma.raw(alias)}.branch_id = ${branchId}` : Prisma.empty;

export class ReportRepository {
  countBookings(where: Prisma.ServiceBookingWhereInput, db: Db = prisma) {
    return db.serviceBooking.count({ where });
  }

  countCustomers(where: Prisma.CustomerWhereInput, db: Db = prisma) {
    return db.customer.count({ where });
  }

  countActiveTechnicians(branchId: number | undefined, db: Db = prisma) {
    return db.staffProfile.count({ where: { isTechnician: true, user: { status: 'ACTIVE' }, ...(branchId ? { branchId } : {}) } });
  }

  sumVerifiedPayments(where: Prisma.PaymentWhereInput, db: Db = prisma) {
    return db.payment.aggregate({ where: { ...where, status: 'VERIFIED' }, _sum: { amount: true }, _count: { _all: true } });
  }

  sumInvoices(where: Prisma.InvoiceWhereInput, db: Db = prisma) {
    return db.invoice.aggregate({
      where: { ...where, status: { not: 'CANCELLED' } },
      _sum: { grandTotal: true, balanceDue: true, amountPaid: true, cgst: true, sgst: true, igst: true, gstTotal: true, taxableAmount: true, discount: true },
      _count: { _all: true },
    });
  }

  bookingStatusDistribution(where: Prisma.ServiceBookingWhereInput, db: Db = prisma) {
    return db.serviceBooking.groupBy({ by: ['status'], where, _count: { _all: true } });
  }

  monthlyRevenue(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ month: string; revenue: Prisma.Decimal; invoices: bigint }>>`
      SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS month, SUM(i.grand_total) AS revenue, COUNT(*) AS invoices
        FROM invoices i
       WHERE i.status <> 'CANCELLED' AND i.invoice_date BETWEEN ${range.from} AND ${range.to} ${branchSql('i', branchId)}
       GROUP BY month ORDER BY month`;
  }

  monthlyCollections(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ month: string; collected: Prisma.Decimal }>>`
      SELECT DATE_FORMAT(p.received_at, '%Y-%m') AS month, SUM(p.amount) AS collected
        FROM payments p JOIN customers c ON c.id = p.customer_id
       WHERE p.status = 'VERIFIED' AND p.received_at BETWEEN ${range.from} AND ${range.to} ${branchSql('c', branchId)}
       GROUP BY month ORDER BY month`;
  }

  bookingTrend(range: DateRange, branchId: number | undefined, granularity: 'day' | 'month', db: Db = prisma) {
    const fmt = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
    return db.$queryRaw<Array<{ period: string; total: bigint; completed: bigint; cancelled: bigint }>>`
      SELECT DATE_FORMAT(b.created_at, ${fmt}) AS period,
             COUNT(*) AS total,
             SUM(b.status = 'COMPLETED') AS completed,
             SUM(b.status IN ('CANCELLED','REJECTED')) AS cancelled
        FROM service_bookings b
       WHERE b.created_at BETWEEN ${range.from} AND ${range.to} ${branchSql('b', branchId)}
       GROUP BY period ORDER BY period`;
  }

  categoryDistribution(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ category: string; bookings: bigint; revenue: Prisma.Decimal }>>`
      SELECT sc.name AS category, COUNT(DISTINCT b.id) AS bookings, COALESCE(SUM(bi.line_total), 0) AS revenue
        FROM booking_items bi
        JOIN service_bookings b ON b.id = bi.booking_id
        JOIN services s ON s.id = bi.service_id
        JOIN service_categories sc ON sc.id = s.category_id
       WHERE b.created_at BETWEEN ${range.from} AND ${range.to} ${branchSql('b', branchId)}
       GROUP BY sc.name ORDER BY bookings DESC`;
  }

  serviceWise(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ service: string; code: string; bookings: bigint; completed: bigint; revenue: Prisma.Decimal }>>`
      SELECT bi.service_name AS service, bi.service_code AS code, COUNT(*) AS bookings,
             SUM(b.status = 'COMPLETED') AS completed, COALESCE(SUM(bi.line_total), 0) AS revenue
        FROM booking_items bi JOIN service_bookings b ON b.id = bi.booking_id
       WHERE b.created_at BETWEEN ${range.from} AND ${range.to} ${branchSql('b', branchId)}
       GROUP BY bi.service_name, bi.service_code ORDER BY bookings DESC`;
  }

  branchPerformance(range: DateRange, db: Db = prisma) {
    return db.$queryRaw<Array<{ branchId: number; branch: string; bookings: bigint; completed: bigint; revenue: Prisma.Decimal; collected: Prisma.Decimal }>>`
      SELECT br.id AS branchId, br.name AS branch,
             (SELECT COUNT(*) FROM service_bookings b WHERE b.branch_id = br.id AND b.created_at BETWEEN ${range.from} AND ${range.to}) AS bookings,
             (SELECT COUNT(*) FROM service_bookings b WHERE b.branch_id = br.id AND b.status = 'COMPLETED' AND b.created_at BETWEEN ${range.from} AND ${range.to}) AS completed,
             (SELECT COALESCE(SUM(i.grand_total),0) FROM invoices i WHERE i.branch_id = br.id AND i.status <> 'CANCELLED' AND i.invoice_date BETWEEN ${range.from} AND ${range.to}) AS revenue,
             (SELECT COALESCE(SUM(i.amount_paid),0) FROM invoices i WHERE i.branch_id = br.id AND i.status <> 'CANCELLED' AND i.invoice_date BETWEEN ${range.from} AND ${range.to}) AS collected
        FROM branches br WHERE br.is_active = 1 ORDER BY revenue DESC`;
  }

  technicianPerformance(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ staffId: number; name: string; staffCode: string; assigned: bigint; completed: bigint; rejected: bigint; revenue: Prisma.Decimal }>>`
      SELECT sp.id AS staffId, u.name AS name, sp.staff_code AS staffCode,
             COUNT(ta.id) AS assigned,
             SUM(ta.status = 'COMPLETED') AS completed,
             SUM(ta.status = 'REJECTED') AS rejected,
             COALESCE(SUM(CASE WHEN ta.status = 'COMPLETED' THEN b.estimated_total ELSE 0 END), 0) AS revenue
        FROM staff_profiles sp
        JOIN users u ON u.id = sp.user_id
        LEFT JOIN technician_assignments ta ON ta.staff_id = sp.id AND ta.assigned_at BETWEEN ${range.from} AND ${range.to}
        LEFT JOIN service_bookings b ON b.id = ta.booking_id
       WHERE sp.is_technician = 1 ${branchSql('sp', branchId)}
       GROUP BY sp.id, u.name, sp.staff_code ORDER BY completed DESC`;
  }

  customerReport(range: DateRange, branchId: number | undefined, take: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ id: number; code: string; name: string; mobile: string; bookings: bigint; billed: Prisma.Decimal; paid: Prisma.Decimal }>>`
      SELECT c.id, c.customer_code AS code, c.full_name AS name, c.mobile,
             (SELECT COUNT(*) FROM service_bookings b WHERE b.customer_id = c.id AND b.created_at BETWEEN ${range.from} AND ${range.to}) AS bookings,
             (SELECT COALESCE(SUM(i.grand_total),0) FROM invoices i WHERE i.customer_id = c.id AND i.status <> 'CANCELLED' AND i.invoice_date BETWEEN ${range.from} AND ${range.to}) AS billed,
             (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.customer_id = c.id AND p.status = 'VERIFIED' AND p.received_at BETWEEN ${range.from} AND ${range.to}) AS paid
        FROM customers c
       WHERE c.deleted_at IS NULL ${branchSql('c', branchId)}
       ORDER BY billed DESC LIMIT ${take}`;
  }

  gstReport(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ month: string; taxable: Prisma.Decimal; cgst: Prisma.Decimal; sgst: Prisma.Decimal; igst: Prisma.Decimal; total: Prisma.Decimal; invoices: bigint }>>`
      SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS month,
             SUM(i.taxable_amount) AS taxable, SUM(i.cgst) AS cgst, SUM(i.sgst) AS sgst, SUM(i.igst) AS igst,
             SUM(i.grand_total) AS total, COUNT(*) AS invoices
        FROM invoices i
       WHERE i.status <> 'CANCELLED' AND i.apply_gst = 1 AND i.invoice_date BETWEEN ${range.from} AND ${range.to} ${branchSql('i', branchId)}
       GROUP BY month ORDER BY month`;
  }

  paymentMethodSplit(range: DateRange, branchId?: number, db: Db = prisma) {
    return db.$queryRaw<Array<{ method: string; status: string; count: bigint; amount: Prisma.Decimal }>>`
      SELECT p.method, p.status, COUNT(*) AS count, SUM(p.amount) AS amount
        FROM payments p JOIN customers c ON c.id = p.customer_id
       WHERE p.created_at BETWEEN ${range.from} AND ${range.to} ${branchSql('c', branchId)}
       GROUP BY p.method, p.status`;
  }

  amcSummary(branchId?: number, db: Db = prisma) {
    return db.amcContract.groupBy({
      by: ['status'],
      where: branchId ? { branchId } : {},
      _count: { _all: true },
      _sum: { contractAmount: true },
    });
  }

  recentBookings(where: Prisma.ServiceBookingWhereInput, take: number, db: Db = prisma) {
    return db.serviceBooking.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        scheduledDate: true,
        estimatedTotal: true,
        customer: { select: { fullName: true } },
        items: { select: { serviceName: true }, take: 1 },
      },
    });
  }

  upcomingAppointments(where: Prisma.ServiceBookingWhereInput, take: number, db: Db = prisma) {
    return db.serviceBooking.findMany({
      where,
      take,
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
        customer: { select: { fullName: true } },
        items: { select: { serviceName: true }, take: 1 },
        assignments: { where: { isCurrent: true }, select: { staff: { select: { user: { select: { name: true } } } } } },
      },
    });
  }

  recentPayments(where: Prisma.PaymentWhereInput, take: number, db: Db = prisma) {
    return db.payment.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: { id: true, paymentNumber: true, amount: true, method: true, status: true, createdAt: true, customer: { select: { fullName: true } } },
    });
  }

  recentAssignments(where: Prisma.TechnicianAssignmentWhereInput, take: number, db: Db = prisma) {
    return db.technicianAssignment.findMany({
      where,
      take,
      orderBy: { assignedAt: 'desc' },
      select: {
        id: true,
        status: true,
        assignedAt: true,
        booking: { select: { id: true, bookingNumber: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
    });
  }

  countPayments(where: Prisma.PaymentWhereInput, db: Db = prisma) {
    return db.payment.count({ where });
  }

  countAmc(where: Prisma.AmcContractWhereInput, db: Db = prisma) {
    return db.amcContract.count({ where });
  }

  // ─── Global search ───
  async globalSearch(term: string, branchId: number | undefined, take: number, db: Db = prisma) {
    const b = branchId ? { branchId } : {};
    const [bookings, customers, invoices, services, staff, amc] = await Promise.all([
      db.serviceBooking.findMany({
        where: { ...b, OR: [{ bookingNumber: { contains: term } }, { customer: { mobile: { contains: term } } }] },
        take,
        select: { id: true, bookingNumber: true, status: true, customer: { select: { fullName: true } } },
      }),
      db.customer.findMany({
        where: {
          ...b,
          deletedAt: null,
          OR: [{ fullName: { contains: term } }, { mobile: { contains: term } }, { customerCode: { contains: term } }, { email: { contains: term } }],
        },
        take,
        select: { id: true, fullName: true, mobile: true, customerCode: true },
      }),
      db.invoice.findMany({
        where: { ...b, invoiceNumber: { contains: term } },
        take,
        select: { id: true, invoiceNumber: true, grandTotal: true, status: true },
      }),
      db.service.findMany({
        where: { OR: [{ name: { contains: term } }, { code: { contains: term } }] },
        take,
        select: { id: true, name: true, code: true },
      }),
      db.staffProfile.findMany({
        where: { ...b, OR: [{ user: { name: { contains: term } } }, { staffCode: { contains: term } }, { user: { mobile: { contains: term } } }] },
        take,
        select: { id: true, staffCode: true, user: { select: { name: true } } },
      }),
      db.amcContract.findMany({
        where: { ...b, amcNumber: { contains: term } },
        take,
        select: { id: true, amcNumber: true, status: true, customer: { select: { fullName: true } } },
      }),
    ]);
    return { bookings, customers, invoices, services, staff, amc };
  }
}
