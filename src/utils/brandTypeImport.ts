import type { BrandType, BrandTypePayload } from "../api/brandType.api";

export function brandTypeImportChanged(
  existing: BrandType,
  incoming: BrandTypePayload,
): boolean {
  return (
    existing.name.trim() !== incoming.name ||
    existing.category_ingredient_id !== incoming.category_ingredient_id ||
    (existing.subcategory_ingredient_id || "") !==
      (incoming.subcategory_ingredient_id || "") ||
    existing.active !== incoming.active
  );
}
