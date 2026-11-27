/**
 * Document generation: branded invoice PDF, tabular PDF/Excel/CSV exports.
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { config } from '../config';
import { InvoiceDetail } from '../repositories/financeRepository';
import { formatDisplayDate, formatInr, moneyNumber } from '../utils/helpers';

/** Invoice item table sizing: rows shrink between these bounds so the invoice stays on one A4 page. */
const ITEM_TABLE = {
  /** Space kept free below the items for totals, notes and the footer (pt). */
  BOTTOM_RESERVE: 200,
  FONT_MAX: 9,
  FONT_MIN: 6.5,
  FONT_STEP: 0.5,
  PAD_MAX: 10,
  PAD_MIN: 4,
} as const;

const BRAND = {
  blue: '#0048A8',
  green: '#7AB83A',
  navy: '#0F1F3D',
  slate: '#5B6B82',
  line: '#E3E8EF',
  soft: '#F4F8EC',
};

const LOGO_CANDIDATES = ['brand/logo.png', 'brand/logo.jpg'];

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  money?: boolean;
}

export class DocumentService {
  private logoPath(): string | null {
    for (const rel of LOGO_CANDIDATES) {
      const p = path.resolve(config.upload.dir, rel);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /** Renders a branded A4 invoice PDF from the invoice's stored snapshot. */
  invoicePdf(inv: InvoiceDetail): Promise<Buffer> {
    const snap = inv.snapshot as {
      company?: { name?: string; legalName?: string; tagline?: string; address?: string; phone?: string; email?: string; gstin?: string; stateCode?: string; website?: string };
      branch?: { name?: string; address?: string; phone?: string; gstin?: string } | null;
      customer?: { name?: string; code?: string; mobile?: string; email?: string; address?: string };
      bookingNumber?: string;
      amcNumber?: string;
      sacCode?: string;
    };
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${inv.invoiceNumber}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const W = doc.page.width - 80;
    const logo = this.logoPath();
    if (logo) doc.image(logo, 40, 34, { fit: [190, 56] });
    else doc.fillColor(BRAND.blue).font('Helvetica-Bold').fontSize(20).text(snap.company?.name || 'Local Air Solutions', 40, 40);

    doc.fillColor(BRAND.navy).font('Helvetica-Bold').fontSize(22).text(inv.isFreeService ? 'FREE SERVICE INVOICE' : 'TAX INVOICE', 40, 40, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.slate)
      .text(`Invoice No: ${inv.invoiceNumber}`, 40, 68, { width: W, align: 'right' })
      .text(`Date: ${formatDisplayDate(inv.invoiceDate)}`, { width: W, align: 'right' })
      .text(snap.bookingNumber ? `Booking: ${snap.bookingNumber}` : snap.amcNumber ? `AMC: ${snap.amcNumber}` : '', { width: W, align: 'right' });

    doc.moveTo(40, 112).lineTo(40 + W, 112).lineWidth(2).strokeColor(BRAND.green).stroke();

    // From / Bill to
    const top = 124;
    // FROM = Settings → Company Profile; the branch only adds its name (and its own GSTIN when separately registered).
    const company = snap.company ?? {};
    const branch = snap.branch ?? null;
    doc.fillColor(BRAND.slate).fontSize(8).font('Helvetica-Bold').text('FROM', 40, top);
    doc.fillColor(BRAND.navy).fontSize(10).font('Helvetica-Bold').text(company.legalName || company.name || '', 40, top + 12, { width: W / 2 - 10 });
    const fromLines = [
      company.address || branch?.address,
      branch?.name ? `Branch: ${branch.name}` : '',
      [company.phone || branch?.phone, company.email].filter(Boolean).join(' · '),
      company.website,
    ].filter(Boolean);
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.slate).text(fromLines.join('\n'), { width: W / 2 - 10 });
    const gstin = branch?.gstin || company.gstin;
    const stateCode = branch?.gstin ? '' : company.stateCode;
    if (gstin) doc.text(`GSTIN: ${gstin}${stateCode ? ` · State code: ${stateCode}` : ''}`, { width: W / 2 - 10 });

    const cx = 40 + W / 2 + 10;
    doc.fillColor(BRAND.slate).fontSize(8).font('Helvetica-Bold').text('BILL TO', cx, top);
    doc.fillColor(BRAND.navy).fontSize(10).font('Helvetica-Bold').text(snap.customer?.name ?? '', cx, top + 12, { width: W / 2 - 10 });
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.slate)
      .text(`${snap.customer?.code ?? ''}  ${snap.customer?.mobile ?? ''}`, { width: W / 2 - 10 })
      .text(snap.customer?.address ?? '', { width: W / 2 - 10 });
    if (snap.customer?.email) doc.text(snap.customer.email, { width: W / 2 - 10 });

    // Items table
    let y = Math.max(doc.y, 210) + 16;
    const cols = [
      { h: '#', w: 22, a: 'left' as const },
      { h: 'Description', w: W - 22 - 50 - 40 - 70 - 60 - 45 - 75, a: 'left' as const },
      { h: 'SAC', w: 50, a: 'left' as const },
      { h: 'Qty', w: 40, a: 'right' as const },
      { h: 'Rate', w: 70, a: 'right' as const },
      { h: 'Discount', w: 60, a: 'right' as const },
      { h: 'GST %', w: 45, a: 'right' as const },
      { h: 'Amount', w: 75, a: 'right' as const },
    ];
    doc.rect(40, y, W, 22).fill(BRAND.blue);
    let x = 40;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) {
      doc.text(c.h, x + 4, y + 7, { width: c.w - 8, align: c.a });
      x += c.w;
    }
    y += 22;
    // One-page invoice: shrink the item rows (font, padding, then one-line descriptions) until they fit
    // above the totals block. A second page is only a last resort for very long invoices.
    const itemsBottom = doc.page.height - ITEM_TABLE.BOTTOM_RESERVE;
    const descWidth = cols[1].w - 8;
    const rowHeights = (fs: number, pad: number, oneLine: boolean) => {
      doc.font('Helvetica').fontSize(fs);
      return inv.items.map((it) => (oneLine ? fs + pad : Math.max(fs + 11, doc.heightOfString(it.description, { width: descWidth }) + pad)));
    };
    const total = (hs: number[]) => hs.reduce((s, h) => s + h, 0);
    let fontSize: number = ITEM_TABLE.FONT_MAX;
    let pad: number = ITEM_TABLE.PAD_MAX;
    let oneLine = false;
    let heights = rowHeights(fontSize, pad, oneLine);
    while (y + total(heights) > itemsBottom && fontSize > ITEM_TABLE.FONT_MIN) {
      fontSize -= ITEM_TABLE.FONT_STEP;
      pad = Math.max(ITEM_TABLE.PAD_MIN, pad - 1);
      heights = rowHeights(fontSize, pad, oneLine);
    }
    if (y + total(heights) > itemsBottom) {
      oneLine = true;
      heights = rowHeights(fontSize, pad, oneLine);
    }
    doc.font('Helvetica').fontSize(fontSize).fillColor(BRAND.navy);
    inv.items.forEach((it, i) => {
      const vals = [String(i + 1), it.description, it.hsnSac ?? snap.sacCode ?? '', String(it.quantity), formatInr(it.rate), formatInr(it.discount), `${moneyNumber(it.gstRate)}`, formatInr(it.amount)];
      const h = heights[i];
      if (y + h > itemsBottom) {
        doc.addPage();
        y = 40;
      }
      if (i % 2 === 1) doc.rect(40, y, W, h).fill(BRAND.soft).fillColor(BRAND.navy);
      x = 40;
      vals.forEach((v, ci) => {
        const clamp = oneLine && ci === 1 ? { height: fontSize + 2, ellipsis: true } : {};
        doc.fillColor(BRAND.navy).text(v, x + 4, y + pad / 2, { width: cols[ci].w - 8, align: cols[ci].a, ...clamp });
        x += cols[ci].w;
      });
      y += h;
    });
    doc.moveTo(40, y).lineTo(40 + W, y).lineWidth(0.5).strokeColor(BRAND.line).stroke();

    // Totals
    y += 12;
    const tx = 40 + W - 220;
    const row = (label: string, value: string, bold = false, color = BRAND.navy) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(BRAND.slate).text(label, tx, y, { width: 120 });
      doc.fillColor(color).text(value, tx + 120, y, { width: 100, align: 'right' });
      y += bold ? 20 : 16;
    };
    row('Subtotal', `₹ ${formatInr(inv.subtotal)}`.replace('₹', 'Rs.'));
    if (moneyNumber(inv.discount) > 0) row(inv.isFreeService ? 'Free service discount' : 'Discount', `- Rs. ${formatInr(inv.discount)}`);
    row('Taxable amount', `Rs. ${formatInr(inv.taxableAmount)}`);
    if (inv.applyGst) {
      if (inv.isInterState) row('IGST', `Rs. ${formatInr(inv.igst)}`);
      else {
        row('CGST', `Rs. ${formatInr(inv.cgst)}`);
        row('SGST', `Rs. ${formatInr(inv.sgst)}`);
      }
    }
    doc.moveTo(tx, y).lineTo(40 + W, y).lineWidth(1).strokeColor(BRAND.green).stroke();
    y += 6;
    row('Grand Total', `Rs. ${formatInr(inv.grandTotal)}`, true, BRAND.blue);
    row('Amount paid', `Rs. ${formatInr(inv.amountPaid)}`);
    row('Balance due', `Rs. ${formatInr(inv.balanceDue)}`, true, moneyNumber(inv.balanceDue) > 0 ? '#C2410C' : BRAND.green);

    // Status badge
    const status = inv.status === 'PAID' ? 'PAID' : inv.status === 'CANCELLED' ? 'CANCELLED' : moneyNumber(inv.amountPaid) > 0 ? 'PARTIALLY PAID' : 'UNPAID';
    doc.roundedRect(40, y - 60, 120, 26, 6).lineWidth(1.2).strokeColor(status === 'PAID' ? BRAND.green : '#C2410C').stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(status === 'PAID' ? BRAND.green : '#C2410C').text(status, 40, y - 52, { width: 120, align: 'center' });

    if (inv.notes) {
      y += 8;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.slate).text('Notes', 40, y);
      // Notes never run into the footer (keeps the invoice on one page).
      const notesTop = doc.y + 2;
      const notesRoom = doc.page.height - 70 - 8 - notesTop;
      if (notesRoom > 10) doc.font('Helvetica').fillColor(BRAND.navy).text(inv.notes, 40, notesTop, { width: W, height: notesRoom, ellipsis: true });
    }

    // Footer
    const fy = doc.page.height - 70;
    // The footer sits inside the bottom margin on purpose; without this PDFKit starts an empty extra page.
    doc.page.margins.bottom = 0;
    doc.moveTo(40, fy).lineTo(40 + W, fy).lineWidth(0.5).strokeColor(BRAND.line).stroke();
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.green).text(company.tagline || 'Cool Comfort Care', 40, fy + 10, { width: W, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(BRAND.slate).text('This is a computer-generated invoice and does not require a signature.', 40, fy + 24, { width: W, align: 'center' });

    doc.end();
    return done;
  }

  toCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): Buffer {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
      // Neutralize spreadsheet formula injection.
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))];
    return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
  }

  async toXlsx(title: string, rows: Record<string, unknown>[], columns: ExportColumn[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Local Air Solutions';
    const ws = wb.addWorksheet(title.slice(0, 31));
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 4) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0048A8' } };
    rows.forEach((r) => ws.addRow(r));
    columns.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = '#,##0.00';
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  toPdfTable(title: string, subtitle: string, rows: Record<string, unknown>[], columns: ExportColumn[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', layout: columns.length > 6 ? 'landscape' : 'portrait', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    const W = doc.page.width - 72;
    const logo = this.logoPath();
    if (logo) doc.image(logo, 36, 28, { fit: [150, 44] });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND.navy).text(title, 36, 32, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.slate).text(subtitle, { width: W, align: 'right' });
    let y = 86;
    const cw = W / columns.length;
    const header = () => {
      doc.rect(36, y, W, 20).fill(BRAND.blue);
      columns.forEach((c, i) => doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(c.header, 36 + i * cw + 4, y + 6, { width: cw - 8, align: c.money ? 'right' : 'left' }));
      y += 20;
    };
    header();
    rows.forEach((r, ri) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 36;
        header();
      }
      if (ri % 2 === 1) doc.rect(36, y, W, 18).fill(BRAND.soft);
      columns.forEach((c, i) => {
        const v = r[c.key];
        const s = c.money ? formatInr(Number(v ?? 0)) : v === null || v === undefined ? '' : String(v);
        doc.font('Helvetica').fontSize(8).fillColor(BRAND.navy).text(s, 36 + i * cw + 4, y + 5, { width: cw - 8, align: c.money ? 'right' : 'left', lineBreak: false, ellipsis: true });
      });
      y += 18;
    });
    if (!rows.length) doc.font('Helvetica').fontSize(10).fillColor(BRAND.slate).text('No data for the selected filters.', 36, y + 10);
    doc.end();
    return done;
  }
}
