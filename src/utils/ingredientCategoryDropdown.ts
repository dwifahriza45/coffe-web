import type { WorkBook } from "xlsx-js-style";
import { addWorkbookDropdowns } from "./workbookDropdown";

export function addIngredientCategoryDropdown(
  workbook: WorkBook,
  categoryNames: string[],
  subcategoryNames: string[] = [],
): ArrayBuffer {
  return addWorkbookDropdowns(workbook, [
    { column: "C", name: "IngredientCategoryOptions", options: categoryNames },
    { column: "D", name: "IngredientSubcategoryOptions", options: subcategoryNames },
  ]);
}
