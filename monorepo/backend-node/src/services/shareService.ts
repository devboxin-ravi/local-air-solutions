/**
 * Sharing: correctly encoded wa.me links (manual WhatsApp) and SMTP email delivery
 * of invoices (single + bulk) to customers and selected staff.
 */

import { config } from '../config';
import { ErrorMessages, SharedLinks } from '../constants';
import { IntegrationUrls } from '../constants/integrations';
import type { AuthUser, ShareLink } from '../models';
import { BusinessRuleError, NotFoundError } from '../utils/errors';
import { addDays, buildWhatsAppLink, formatDisplayDate, formatInr, moneyNumber } from '../utils/helpers';
import { createSignedToken, verifySignedToken } from '../utils/signedToken';
import { BookingService } from './bookingService';
import { EmailProvider } from './deliveryProviders';
import { DocumentService } from './documentService';
import { InvoiceService } from './invoiceService';
import { SettingsService } from './settingsService';
import { EngagementRepository } from '../repositories/engagementRepository';
import { UserRepository } from '../repositories/userRepository';
import { assertBranchAccess } from './accessControl';

export class ShareService {
  constructor(
    private readonly bookings: BookingService,
    private readonly invoices: InvoiceService,
    private readonly documents: DocumentService,
    private readonly email: EmailProvider,
    private readonly settings: SettingsService,
    private readonly engagement: EngagementRepository,
    private readonly users: UserRepository,
  ) {}

  async whatsapp(actor: AuthUser, type: 'booking' | 'assignment' | 'invoice' | 'paymentReminder' | 'serviceReminder', id: number): Promise<ShareLink> {
    const company = await this.settings.company();
    const sign = `\n\n— ${company.name}${company.phone ? `\n${company.phone}` : ''}`;

    if (type === 'booking' || type === 'assignment') {
      const b = await this.bookings.get(actor, id);
      const addr = b.addressSnapshot as { line1?: string; city?: string; pincode?: string; latitude?: number | null; longitude?: number | null };
      const services = b.items.map((i) => `• ${i.serviceName} x${i.quantity}`).join('\n') || `• Repair: ${b.problemDescription ?? ''}`;
      if (type === 'booking') {
        const message = `Hello ${b.customer.fullName},\n\nYour booking *${b.bookingNumber}* is ${b.status.replace(/_/g, ' ').toLowerCase()}.\nDate: ${formatDisplayDate(b.scheduledDate)}${b.scheduledTime ? ` (${b.scheduledTime})` : ''}\n${services}\nEstimated: ₹${formatInr(b.estimatedTotal)}${sign}`;
        return { channel: 'WHATSAPP', message, url: buildWhatsAppLink(b.customer.countryCode, b.customer.mobile, message) };
      }
      const tech = b.assignments.find((a) => a.isCurrent);
      if (!tech) throw new BusinessRuleError('No technician assigned yet.');
      const maps = addr.latitude && addr.longitude ? IntegrationUrls.GOOGLE_MAPS_DIRECTIONS(addr.latitude, addr.longitude) : IntegrationUrls.GOOGLE_MAPS_SEARCH(`${addr.line1 ?? ''} ${addr.city ?? ''} ${addr.pincode ?? ''}`);
      const message = `New job *${b.bookingNumber}*\nCustomer: ${b.customer.fullName} (${b.customer.countryCode} ${b.customer.mobile})\nDate: ${formatDisplayDate(b.scheduledDate)}${b.scheduledTime ? ` ${b.scheduledTime}` : ''}\n${services}\nAddress: ${addr.line1 ?? ''}, ${addr.city ?? ''} ${addr.pincode ?? ''}\nMap: ${maps}${b.instructions ? `\nNote: ${b.instructions}` : ''}`;
      return { channel: 'WHATSAPP', message, url: buildWhatsAppLink(tech.staff.user.countryCode, tech.staff.user.mobile, message) };
    }

    if (type === 'invoice' || type === 'paymentReminder') {
      const inv = await this.invoices.get(actor, id);
      const pdfUrl = type === 'invoice' ? this.invoicePdfLink(inv.id) : undefined;
      const message =
        type === 'invoice'
          ? `Hello ${inv.customer.fullName},\n\nInvoice *${inv.invoiceNumber}* dated ${formatDisplayDate(inv.invoiceDate)}\nTotal: ₹${formatInr(inv.grandTotal)}\nPaid: ₹${formatInr(inv.amountPaid)}\nBalance: ₹${formatInr(inv.balanceDue)}\n\nInvoice PDF: ${pdfUrl}${sign}`
          : `Hello ${inv.customer.fullName},\n\nThis is a gentle reminder that ₹${formatInr(inv.balanceDue)} is pending on invoice *${inv.invoiceNumber}*.${company.supportPhone ? `\nFor queries call ${company.supportPhone}.` : ''}${sign}`;
      return { channel: 'WHATSAPP', message, url: buildWhatsAppLink(inv.customer.countryCode, inv.customer.mobile, message), ...(pdfUrl ? { pdfUrl } : {}) };
    }

    const reminder = await this.engagement.findReminder(id);
    if (!reminder) throw new BusinessRuleError('Reminder not found');
    if (reminder.customer.branchId) assertBranchAccess(actor, reminder.customer.branchId);
    const message = `Hello ${reminder.customer.fullName},\n\nYour ${reminder.service?.name ?? 'AC service'} is due on ${formatDisplayDate(reminder.dueDate)}. Regular servicing keeps cooling efficient and power bills low. Reply to book a visit.${sign}`;
    return { channel: 'WHATSAPP', message, url: buildWhatsAppLink(reminder.customer.countryCode, reminder.customer.mobile, message) };
  }

  /** Emails invoice PDFs. Fails clearly when SMTP is not configured — never fakes success. */
  async emailInvoices(actor: AuthUser, invoiceIds: number[], toCustomer: boolean, staffUserIds: number[]) {
    if (!this.email.enabled) throw new BusinessRuleError(ErrorMessages.EMAIL_DISABLED);
    const company = await this.settings.company();
    const staff = await Promise.all(staffUserIds.map((uid) => this.users.findById(uid)));
    const results: Array<{ invoiceId: number; invoiceNumber: string; sentTo: string[]; error?: string }> = [];
    for (const id of invoiceIds) {
      const inv = await this.invoices.get(actor, id);
      const pdf = await this.documents.invoicePdf(inv);
      const recipients = [...(toCustomer && inv.customer.email ? [inv.customer.email] : []), ...staff.map((s) => s?.email).filter((e): e is string => !!e)];
      if (!recipients.length) {
        results.push({ invoiceId: id, invoiceNumber: inv.invoiceNumber, sentTo: [], error: ErrorMessages.CUSTOMER_NO_EMAIL });
        continue;
      }
      try {
        await this.email.send(
          recipients.join(','),
          `Invoice ${inv.invoiceNumber} — ${company.name}`,
          `Dear ${inv.customer.fullName},\n\nPlease find attached invoice ${inv.invoiceNumber} for ₹${formatInr(inv.grandTotal)}.${moneyNumber(inv.balanceDue) > 0 ? `\nBalance due: ₹${formatInr(inv.balanceDue)}.` : '\nThis invoice is fully paid. Thank you!'}\n\nRegards,\n${company.name}`,
          [{ filename: `${inv.invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
        );
        results.push({ invoiceId: id, invoiceNumber: inv.invoiceNumber, sentTo: recipients });
      } catch (e) {
        results.push({ invoiceId: id, invoiceNumber: inv.invoiceNumber, sentTo: [], error: (e as Error).message });
      }
    }
    return results;
  }

  /** Bulk WhatsApp: returns a link per invoice (manual sharing opens each). */
  /** Signed public link to an invoice PDF, valid for SharedLinks.INVOICE_PDF_TTL_DAYS (no login needed). */
  invoicePdfLink(invoiceId: number): string {
    const expiresAt = addDays(new Date(), SharedLinks.INVOICE_PDF_TTL_DAYS);
    const token = createSignedToken(SharedLinks.INVOICE_PDF_PURPOSE, invoiceId, expiresAt, config.jwt.accessSecret);
    return `${config.publicBaseUrl.replace(/\/+$/, '')}${SharedLinks.INVOICE_PDF_PATH(token)}`;
  }

  /** Renders the PDF for a signed public link; tampered, expired or cancelled → not found. */
  async publicInvoicePdf(token: string): Promise<{ invoiceNumber: string; pdf: Buffer }> {
    const id = verifySignedToken(SharedLinks.INVOICE_PDF_PURPOSE, token, config.jwt.accessSecret);
    if (!id) throw new NotFoundError('Invoice');
    const inv = await this.invoices.getForShareLink(id);
    return { invoiceNumber: inv.invoiceNumber, pdf: await this.documents.invoicePdf(inv) };
  }

  async whatsappInvoices(actor: AuthUser, invoiceIds: number[]) {
    return Promise.all(invoiceIds.map(async (id) => ({ invoiceId: id, ...(await this.whatsapp(actor, 'invoice', id)) })));
  }
}
