/**
 * File: backend/src/modules/reports/utils/export-excel.util.ts
 * Fungsi:
 *  - Helper export sheet Excel sederhana dengan ExcelJS:
 *      - Title row (merge),
 *      - Header bold + filter row,
 *      - Auto-width sederhana berbasis content length.
 *  - Mengembalikan Buffer yang bisa langsung dikirim sebagai response.
 */

import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface BuildExcelOptions {
  title: string;
  subtitle?: string;
  sheetName?: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  /**
   * Ringkasan kunci-nilai yang ditempelkan di bawah tabel.
   */
  summary?: Record<string, string | number>;
}

/**
 * buildExcelBuffer()
 * Bangun workbook & sheet, lalu return Buffer.
 */
export async function buildExcelBuffer(opts: BuildExcelOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bursa Kerja Digital';
  wb.created = new Date();

  const ws = wb.addWorksheet(opts.sheetName ?? 'Laporan', {
    properties: { defaultRowHeight: 18 },
  });

  // --- Title row ---
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 16 };
  ws.mergeCells(1, 1, 1, Math.max(1, opts.columns.length));

  let cursorRow = 2;
  if (opts.subtitle) {
    const sub = ws.getCell(cursorRow, 1);
    sub.value = opts.subtitle;
    sub.font = { italic: true, color: { argb: 'FF666666' } };
    ws.mergeCells(cursorRow, 1, cursorRow, Math.max(1, opts.columns.length));
    cursorRow += 1;
  }
  cursorRow += 1;

  // --- Columns ---
  ws.columns = opts.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(12, c.header.length + 2),
  }));

  // ExcelJS menempelkan header di row 1 secara default; karena kita
  // sudah pakai row 1 untuk title, kita pindahkan header ke cursorRow.
  // Strategi sederhana: tulis ulang header pada cursorRow lalu mulai
  // append data dari cursorRow+1.

  const headerRow = ws.getRow(cursorRow);
  opts.columns.forEach((c, idx) => {
    headerRow.getCell(idx + 1).value = c.header;
  });
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFEFEF' },
  };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.commit();

  // Auto filter range
  ws.autoFilter = {
    from: { row: cursorRow, column: 1 },
    to: { row: cursorRow, column: opts.columns.length },
  };

  // --- Data rows ---
  const startDataRow = cursorRow + 1;
  opts.rows.forEach((row, i) => {
    const r = ws.getRow(startDataRow + i);
    opts.columns.forEach((c, idx) => {
      r.getCell(idx + 1).value = formatValue(row[c.key]);
    });
    r.commit();
  });

  // --- Auto-width sederhana (berdasar header + max content) ---
  ws.columns.forEach((col, idx) => {
    const key = opts.columns[idx].key;
    const maxLen = Math.max(
      String(opts.columns[idx].header).length,
      ...opts.rows.map((r) => String(formatValue(r[key]) ?? '').length),
    );
    col.width = Math.min(50, Math.max(12, maxLen + 2));
  });

  // --- Summary di bawah tabel ---
  if (opts.summary && Object.keys(opts.summary).length > 0) {
    const sumStart = startDataRow + opts.rows.length + 2;
    const titleRow = ws.getRow(sumStart);
    titleRow.getCell(1).value = 'Ringkasan';
    titleRow.font = { bold: true };
    titleRow.commit();

    Object.entries(opts.summary).forEach(([k, v], idx) => {
      const r = ws.getRow(sumStart + 1 + idx);
      r.getCell(1).value = k;
      r.getCell(2).value = v;
      r.font = { bold: false };
      r.commit();
    });
  }

  // Generate buffer (ExcelJS returns ArrayBuffer-like)
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

/**
 * formatValue()
 * Konversi Date → ISO string, undefined/null → '', sisanya
 * dilewatkan apa adanya (ExcelJS akan menulis tipe yang sesuai).
 */
function formatValue(v: unknown): string | number | boolean | Date | null {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
