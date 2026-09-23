import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Unit } from "./unit.api";

export interface Ingredient {
  ingredient_id: string;
  name: string;
  base_unit: string;
  base_unit_info?: Unit;
  minimum_stock: string;
  active: boolean;
}

export interface IngredientPayload {
  name: string;
  base_unit: string;
  minimum_stock: string;
  active: boolean;
}

export const getIngredients = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<Ingredient[]>>("/ingredients/list", payload)).data;

export const getIngredient = async (ingredientID: string) =>
  (await api.get<ApiResponse<Ingredient>>(`/ingredients/${ingredientID}`)).data;

export const getIngredientUnitUsage = async (unitIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/ingredients/unit-usage",
      { unit_ids: unitIDs },
    )
  ).data;

export const createIngredient = async (payload: IngredientPayload) =>
  (await api.post<ApiResponse<null>>("/ingredients/", payload)).data;

export const updateIngredient = async (
  ingredientID: string,
  payload: IngredientPayload,
) => (await api.put<ApiResponse<null>>(`/ingredients/${ingredientID}`, payload)).data;

export const deleteIngredient = async (ingredientID: string) =>
  (await api.delete<ApiResponse<null>>(`/ingredients/${ingredientID}`)).data;
