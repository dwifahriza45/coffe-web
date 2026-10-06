import type { Ingredient, IngredientPayload } from "../api/ingredient.api";

export const ingredientExportHeaders = ["Ingredient", "Ingredient Category", "Ingredient subcategory", "Brand / Type", "Supplier", "Packaging unit", "Content", "Min stock"];
const normalize = (value: string) => value.trim().toLowerCase();

export function resolveImportOption<T>(items: T[], label: string, name: (item: T) => string): T {
  const matches = items.filter((item) => normalize(name(item)) === normalize(label));
  if (matches.length !== 1) throw new Error(matches.length ? "Ambiguous ingredient reference" : "Unknown ingredient reference");
  return matches[0];
}

export function parseIngredientQuantity(value: string): { quantity: string; unit: string } {
  const match = value.trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(.+)$/);
  if (!match || !Number.isFinite(Number(match[1].replace(/,/g, ""))) || Number(match[1].replace(/,/g, "")) <= 0) throw new Error("Invalid ingredient quantity");
  return { quantity: match[1].replace(/,/g, ""), unit: match[2].trim() };
}

export function ingredientImportChanged(existing: Ingredient, payload: IngredientPayload): boolean {
  return (Object.keys(payload) as (keyof IngredientPayload)[]).some((key) => {
    if (["package_qty", "content_qty", "minimum_stock"].includes(key)) return Number(existing[key]) !== Number(payload[key]);
    return (existing[key] ?? "") !== (payload[key] ?? "");
  });
}
