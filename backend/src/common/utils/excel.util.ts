import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

export interface ExcelColumn<T> {
  header: string;
  key: string;
  width?: number;
  value?: (row: T) => string | number | Date | null;
}

const BRAND = {
  primary: 'FF4F46E5',
  headerText: 'FFFFFFFF',
  zebra: 'FFF8FAFC',
  border: 'FFE2E8F0',
};

/** Genera un libro de Excel con encabezado corporativo, filtros y zebra striping. */
export async function buildExcel<T>(options: {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}): Promise<Buffer> {
  const { sheetName, title, subtitle, columns, rows } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asistencia Docente por QR';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: subtitle ? 4 : 3 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 22 }));

  // Título
  const lastCol = String.fromCharCode(64 + columns.length);
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 15, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  let headerRowIndex = 3;

  if (subtitle) {
    sheet.mergeCells(`A2:${lastCol}2`);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = subtitle;
    subtitleCell.font = { size: 10, color: { argb: 'FF64748B' } };
    headerRowIndex = 4;
  }

  // Encabezado de columnas
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.values = columns.map((c) => c.header);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRAND.headerText }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.primary } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND.border } },
      bottom: { style: 'thin', color: { argb: BRAND.border } },
      left: { style: 'thin', color: { argb: BRAND.border } },
      right: { style: 'thin', color: { argb: BRAND.border } },
    };
  });

  // Datos
  rows.forEach((row, index) => {
    const values = columns.map((c) => (c.value ? c.value(row) : ((row as Record<string, unknown>)[c.key] as never)));
    const excelRow = sheet.addRow(values);
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'hair', color: { argb: BRAND.border } } };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Escribe la respuesta HTTP como descarga `.xlsx`. */
export function sendExcel(res: Response, buffer: Buffer, filename: string): void {
  const stamped = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${stamped}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
