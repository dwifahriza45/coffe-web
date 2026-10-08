import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Unit } from "./unit.api";

export interface Ingredient {
  subcategory_ingredient_id: string;
  in_use: boolean;
  category_ingredient_name: string;
  ingredient_id: string;
  category_ingredient_id: string;
  name: string;
  base_unit: string;
  base_unit_info?: Unit;
  brand_type_id: string;
  supplier_id: string;
  packaging_id: string;
  package_qty: string;
  content_qty: string;
  content_unit_id: string;
  minimum_stock: string;
  target_stock?: string;
  active: boolean;
}

export interface IngredientPayload {
  subcategory_ingredient_id?: string;
  category_ingredient_id: string;
  name: string;
  brand_type_id: string;
  supplier_id: string;
  packaging_id: string;
  package_qty: string;
  content_qty: string;
  content_unit_id: string;
  minimum_stock: string;
  target_stock?: string;
  active: boolean;
}

export const getIngredients = async (payload: {
  start: number;
  limit: number;
  name: string;
  category_ingredient_id?: string;
  subcategory_ingredient_id?: string;
  supplier_id?: string;
}) =>
  (await api.post<ApiResponse<Ingredient[]>>("/ingredients/list", payload))
    .data;

export const getIngredient = async (ingredientID: string) =>
  (await api.get<ApiResponse<Ingredient>>(`/ingredients/${ingredientID}`)).data;

export const getUnitUsage = async (unitIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/ingredients/unit-usage",
      { unit_ids: unitIDs },
    )
  ).data;

export const createIngredient = async (payload: IngredientPayload) =>
  (await api.post<ApiResponse<Ingredient>>("/ingredients/", payload)).data;

export const updateIngredient = async (
  ingredientID: string,
  payload: IngredientPayload,
) =>
  (await api.put<ApiResponse<null>>(`/ingredients/${ingredientID}`, payload))
    .data;

export const deleteIngredient = async (ingredientID: string) =>
  (await api.delete<ApiResponse<null>>(`/ingredients/${ingredientID}`)).data;

export interface IngredientPriceOption {
  unit_price: string;
  price_content_unit: string;
  in_use: boolean;
  supplier_name: string;
  purchase_no: string;
  price_option_id: string;
  price: string;
  effective_date: string;
  notes: string;
  active: boolean;
}
export const getIngredientPrices = async (ingredientID: string) =>
  (
    await api.get<ApiResponse<IngredientPriceOption[]>>(
      `/ingredients/${encodeURIComponent(ingredientID)}/prices`,
    )
  ).data;
export const setIngredientPriceActive = async (
  ingredientID: string,
  priceID: string,
  active: boolean,
) =>
  (
    await api.put<ApiResponse<null>>(
      `/ingredients/${encodeURIComponent(ingredientID)}/prices/${encodeURIComponent(priceID)}/active`,
      { active },
    )
  ).data;

export type IngredientPricePayload = Pick<
  IngredientPriceOption,
  "price" | "effective_date" | "notes" | "active"
> & { price_basis?: "package" | "unit" };
export const createIngredientPrice = async (
  ingredientID: string,
  payload: IngredientPricePayload,
) =>
  (
    await api.post<ApiResponse<null>>(
      `/ingredients/${encodeURIComponent(ingredientID)}/prices`,
      payload,
    )
  ).data;
export const updateIngredientPrice = async (
  ingredientID: string,
  priceID: string,
  payload: IngredientPricePayload,
) =>
  (
    await api.put<ApiResponse<null>>(
      `/ingredients/${encodeURIComponent(ingredientID)}/prices/${encodeURIComponent(priceID)}`,
      payload,
    )
  ).data;
export const deleteIngredientPrice = async (
  ingredientID: string,
  priceID: string,
) =>
  (
    await api.delete<ApiResponse<null>>(
      `/ingredients/${encodeURIComponent(ingredientID)}/prices/${encodeURIComponent(priceID)}`,
    )
  ).data;

export const getInventoryCategoryCounts = async (payload: { name: string; supplier_id: string }) => (await api.post<ApiResponse<{categories: {category_id: string; count: number}[]; total: number}>>("/ingredients/summary", payload)).data;

export interface StockItemMetadata { ingredient_id: string; brand: string; subcategory: string; supplier: string; packaging: string; content_unit: string; unit_price: string | null }
export const getStockItemMetadata = async () => (await api.get<ApiResponse<StockItemMetadata[]>>("/ingredients/stock-metadata")).data;
