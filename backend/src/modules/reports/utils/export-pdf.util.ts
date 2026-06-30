/**
 * File: backend/src/modules/reports/utils/export-pdf.util.ts
 * Fungsi:
 *  - Helper export laporan PDF dengan PDFKit:
 *      - Header (title + subtitle + tanggal cetak),
 *      - Tabel sederhana dengan kolom + baris data,
 *      - Footer dengan ringkasan opsional.
 *  - Mengembalikan Buffer.
 */

import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';

export interface PdfColumn {
  header: string;
  key: string;
  width: number; // dalam point (1 pt = 1/72 inch)
  align?: 'left' | 'center' | 'right';
}

export interface BuildPdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, string | number>;
}

/**
 * buildPdfBuffer()
 * Generate PDF (landscape) dengan title, table, dan ringkasan.
 */
export function buildPdfBuffer(opts: BuildPdfOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 32,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, opts);
    const tableTop = doc.y + 8;
    drawTableHeader(doc, opts.columns, tableTop);
    drawRows(doc, opts.columns, opts.rows, tableTop + 22);
    if (opts.summary) drawSummary(doc, opts.summary);

    doc.end();
  });
}

// ============================================================
//                          INTERNAL
// ============================================================

function drawHeader(doc: PDFKit.PDFDocument, opts: BuildPdfOptions): void {
  doc.fontSize(16).font('Helvetica-Bold').text(opts.title, { align: 'left' });
  if (opts.subtitle) {
    doc
      .moveDown(0.2)
      .fontSize(10)
      .font('Helvetica-Oblique')
      .fillColor('#555')
      .text(opts.subtitle, { align: 'left' });
  }
  doc
    .moveDown(0.2)
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#555')
    .text(`Tanggal cetak: ${dayjs().format('DD MMM YYYY HH:mm')}`, {
      align: 'left',
    });
  doc.fillColor('#000');
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  top: number,
): void {
  let x = doc.page.margins.left;
  doc
    .rect(
      x,
      top - 4,
      columns.reduce((a, c) => a + c.width, 0),
      20,
    )
    .fill('#EFEFEF')
    .fillColor('#000');

  doc.font('Helvetica-Bold').fontSize(9);
  columns.forEach((c) => {
    doc.text(c.header, x + 4, top + 2, {
      width: c.width - 8,
      align: c.align ?? 'left',
    });
    x += c.width;
  });
}

function drawRows(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  rows: Record<string, unknown>[],
  startY: number,
): void {
  doc.font('Helvetica').fontSize(8);
  let y = startY;
  const lineHeight = 16;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;

  rows.forEach((row, idx) => {
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      drawTableHeader(doc, columns, doc.page.margins.top);
      y = doc.page.margins.top + 22;
      doc.font('Helvetica').fontSize(8);
    }

    let x = doc.page.margins.left;
    if (idx % 2 === 1) {
      doc
        .rect(x, y - 2, columns.reduce((a, c) => a + c.width, 0), lineHeight)
        .fill('#FAFAFA')
        .fillColor('#000');
    }
    columns.forEach((c) => {
      const v = formatCell(row[c.key]);
      doc.text(v, x + 4, y, {
        width: c.width - 8,
        align: c.align ?? 'left',
        ellipsis: true,
        lineBreak: false,
      });
      x += c.width;
    });
    y += lineHeight;
  });
}

function drawSummary(
  doc: PDFKit.PDFDocument,
  summary: Record<string, string | number>,
): void {
  doc.moveDown(2).font('Helvetica-Bold').fontSize(10).text('Ringkasan');
  doc.moveDown(0.3).font('Helvetica').fontSize(9);
  Object.entries(summary).forEach(([k, v]) => {
    doc.text(`${k}: ${v}`);
  });
}

function formatCell(v: unknown): string {
  if (v === undefined || v === null) return '-';
  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD HH:mm');
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
