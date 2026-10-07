import * as XLSX from "xlsx-js-style";

/** Shared table format for master-data Excel exports. */
export function createExportWorksheet(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  columnWidths: number[],
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  const border = {
    top: { style: "thin", color: { rgb: "A9BC96" } },
    right: { style: "thin", color: { rgb: "A9BC96" } },
    bottom: { style: "thin", color: { rgb: "A9BC96" } },
    left: { style: "thin", color: { rgb: "A9BC96" } },
  };
  for (let row = 0; row <= rows.length; row += 1) {
    for (let column = 0; column < headers.length; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      cell.s = {
        border,
        alignment: { horizontal: "center", vertical: "center" },
        ...(row === 0 ? {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "244510" }, patternType: "solid" },
        } : {}),
      };
    }
  }
  return sheet;
}
