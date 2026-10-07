import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx-js-style";

export interface WorkbookDropdown {
  column: string;
  name: string;
  options: string[];
}
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Excel validations are injected because xlsx-js-style does not serialize them. */
export function addWorkbookDropdowns(workbook: XLSX.WorkBook, dropdowns: WorkbookDropdown[]): ArrayBuffer {
  const lists = dropdowns.map((list, index) => ({
    ...list,
    sheet: `Options ${index + 1}`,
    options: [...new Set(list.options.filter((option) => option.trim()))],
  })).filter((list) => list.options.length);
  for (const list of lists) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(list.options.map((option) => [option])), list.sheet);
  }
  if (lists.length) {
    workbook.Workbook ??= {};
    const previous = workbook.Workbook.Sheets ?? [];
    workbook.Workbook.Sheets = workbook.SheetNames.map((name) => ({
      ...previous.find((sheet) => sheet.name === name), name,
      Hidden: lists.some((list) => list.sheet === name) ? 1 : previous.find((sheet) => sheet.name === name)?.Hidden ?? 0,
    }));
    workbook.Workbook.Names = [
      ...(workbook.Workbook.Names ?? []),
      ...lists.map((list) => ({ Name: list.name, Ref: `'${list.sheet}'!$A$1:$A$${list.options.length}` })),
    ];
  }
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  if (!lists.length) return bytes;
  const files = unzipSync(new Uint8Array(bytes));
  const path = "xl/worksheets/sheet1.xml";
  const validations = `<dataValidations count="${lists.length}">${lists.map((list) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Pilihan tidak valid" error="Pilih nilai dari dropdown." sqref="${escapeXml(list.column)}2:${escapeXml(list.column)}1048576"><formula1>${escapeXml(list.name)}</formula1></dataValidation>`).join("")}</dataValidations>`;
  files[path] = strToU8(strFromU8(files[path]).replace("</sheetData>", `</sheetData>${validations}`));
  return new Uint8Array(zipSync(files)).buffer;
}

export function downloadWorkbookFile(bytes: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
