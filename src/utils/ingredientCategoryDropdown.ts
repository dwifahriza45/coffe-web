import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx-js-style";

export function addIngredientCategoryDropdown(
  workbook: XLSX.WorkBook,
  categoryNames: string[],
): ArrayBuffer {
  const names = [...new Set(categoryNames)];
  if (names.length > 0) {
    const sheetName = "Ingredient Categories";
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(names.map((name) => [name])),
      sheetName,
    );
    workbook.Workbook ??= {};
    workbook.Workbook.Sheets = workbook.SheetNames.map((name) => ({
      name,
      Hidden: name === sheetName ? 1 : 0,
    }));
    workbook.Workbook.Names = [{
      Name: "IngredientCategoryOptions",
      Ref: `'${sheetName}'!$A$1:$A$${names.length}`,
    }];
  }

  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  if (names.length === 0) return bytes;

  // xlsx-js-style preserves formatting but does not serialize data validation.
  const files = unzipSync(new Uint8Array(bytes));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const validation = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Kategori tidak valid" error="Pilih kategori bahan dari dropdown." sqref="C2:C1048576"><formula1>IngredientCategoryOptions</formula1></dataValidation></dataValidations>';
  files[sheetPath] = strToU8(
    strFromU8(files[sheetPath]).replace("</sheetData>", `</sheetData>${validation}`),
  );
  return new Uint8Array(zipSync(files)).buffer;
}
