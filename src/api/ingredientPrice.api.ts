import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { BrandType } from "./brandType.api";
import type { Ingredient } from "./ingredient.api";
import type { Packaging } from "./packaging.api";
import type { Supplier } from "./supplier.api";
import type { Unit } from "./unit.api";

export interface IngredientPrice {
  price_id: string;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  brand_type_id: string;
  brand_type_info?: BrandType;
  supplier_id: string;
  supplier_info?: Supplier;
  packaging_id: string;
  packaging_info?: Packaging;
  package_qty: string;
  content_qty: string;
  content_unit_id: string;
  content_unit_info?: Unit;
  price: string;
  effective_date: string;
  unit_price: string;
  active: boolean;
}

export interface IngredientPricePayload {
  ingredient_id: string;
  brand_type_id: string;
  supplier_id: string;
  packaging_id: string;
  package_qty: string;
  content_qty: string;
  content_unit_id: string;
  price: string;
  effective_date: string;
  active: boolean;
}

export const getIngredientPrices = async (payload: {
  start: number;
  limit: number;
  name: string;
}) =>
  (await api.post<ApiResponse<IngredientPrice[]>>("/ingredient-prices/list", payload)).data;

export const createIngredientPrice = async (payload: IngredientPricePayload) =>
  (await api.post<ApiResponse<null>>("/ingredient-prices/", payload)).data;

export const updateIngredientPrice = async (
  priceID: string,
  payload: IngredientPricePayload,
) => (await api.put<ApiResponse<null>>(`/ingredient-prices/${priceID}`, payload)).data;

export const deleteIngredientPrice = async (priceID: string) =>
  (await api.delete<ApiResponse<null>>(`/ingredient-prices/${priceID}`)).data;
