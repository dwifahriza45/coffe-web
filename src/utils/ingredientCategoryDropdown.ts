import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx-js-style";

export function addIngredientCategoryDropdown(
  workbook: XLSX.WorkBook,
  categoryNames: string[],
  subcategoryNames: string[] = [],
): ArrayBuffer {
  const lists = [
    { names: [...new Set(categoryNames)], sheet: "Ingredient Categories", range: "C2:C1048576", name: "IngredientCategoryOptions", title: "Kategori tidak valid", error: "Pilih kategori bahan dari dropdown." },
    { names: [...new Set(subcategoryNames)], sheet: "Ingredient Subcategories", range: "D2:D1048576", name: "IngredientSubcategoryOptions", title: "Subkategori tidak valid", error: "Pilih subkategori bahan dari dropdown." },
  ].filter((list) => list.names.length > 0);

  for (const list of lists) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(list.names.map((name) => [name])), list.sheet);
  }
  if (lists.length > 0) {
    workbook.Workbook ??= {};
    const previousSheets = workbook.Workbook.Sheets ?? [];
    workbook.Workbook.Sheets = workbook.SheetNames.map((name) => ({
      ...previousSheets.find((sheet) => sheet.name === name),
      name,
      Hidden: lists.some((list) => list.sheet === name) ? 1 : previousSheets.find((sheet) => sheet.name === name)?.Hidden ?? 0,
    }));
    workbook.Workbook.Names = [
      ...(workbook.Workbook.Names ?? []),
      ...lists.map((list) => ({ Name: list.name, Ref: `'${list.sheet}'!$A$1:$A$${list.names.length}` })),
    ];
  }

  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  if (lists.length === 0) return bytes;

  // xlsx-js-style does not serialize data validation, so add it to the worksheet XML.
  const files = unzipSync(new Uint8Array(bytes));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const validation = `<dataValidations count="${lists.length}">${lists.map((list) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="${list.title}" error="${list.error}" sqref="${list.range}"><formula1>${list.name}</formula1></dataValidation>`).join("")}</dataValidations>`;
  files[sheetPath] = strToU8(strFromU8(files[sheetPath]).replace("</sheetData>", `</sheetData>${validation}`));
  return new Uint8Array(zipSync(files)).buffer;
}
