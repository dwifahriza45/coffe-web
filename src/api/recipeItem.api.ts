import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Ingredient } from "./ingredient.api";
import type { Recipe } from "./recipe.api";

export interface RecipeItem {
  recipe_item_id: string;
  recipe_id: string;
  recipe_info?: Recipe;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  quantity: string;
}

export interface RecipeItemPayload {
  recipe_id: string;
  ingredient_id: string;
  quantity: string;
}

export const getRecipeItems = async (payload: {
  start: number;
  limit: number;
  recipe_id: string;
  ingredient_id: string;
  name: string;
}) => (await api.post<ApiResponse<RecipeItem[]>>("/recipe-items/list", payload)).data;

export const getRecipeItemUsage = async (recipeIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/recipe-items/recipe-usage",
      { recipe_ids: recipeIDs },
    )
  ).data;

export const createRecipeItem = async (payload: RecipeItemPayload) =>
  (await api.post<ApiResponse<null>>("/recipe-items/", payload)).data;

export const updateRecipeItem = async (
  recipeItemID: string,
  payload: RecipeItemPayload,
) => (await api.put<ApiResponse<null>>(`/recipe-items/${recipeItemID}`, payload)).data;

export const deleteRecipeItem = async (recipeItemID: string) =>
  (await api.delete<ApiResponse<null>>(`/recipe-items/${recipeItemID}`)).data;
