import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Ingredient } from "./ingredient.api";
import type { Unit } from "./unit.api";

export interface IngredientUnit {
  ingredient_unit_id: string;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  unit_id: string;
  unit_info?: Unit;
  conversion_factor: string;
  active: boolean;
}

export interface IngredientUnitPayload {
  ingredient_id: string;
  unit_id: string;
  conversion_factor: string;
  active: boolean;
}

export const getIngredientUnits = async (payload: {
  start: number;
  limit: number;
  ingredient_id: string;
  unit_id: string;
  name: string;
}) =>
  (await api.post<ApiResponse<IngredientUnit[]>>("/ingredient-units/list", payload)).data;

export const getIngredientUsage = async (ingredientIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/ingredient-units/ingredient-usage",
      { ingredient_ids: ingredientIDs },
    )
  ).data;

export const createIngredientUnit = async (payload: IngredientUnitPayload) =>
  (await api.post<ApiResponse<null>>("/ingredient-units/", payload)).data;

export const updateIngredientUnit = async (
  ingredientUnitID: string,
  payload: IngredientUnitPayload,
) =>
  (await api.put<ApiResponse<null>>(`/ingredient-units/${ingredientUnitID}`, payload)).data;

export const deleteIngredientUnit = async (ingredientUnitID: string) =>
  (await api.delete<ApiResponse<null>>(`/ingredient-units/${ingredientUnitID}`)).data;
