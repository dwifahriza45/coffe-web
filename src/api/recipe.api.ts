import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Product } from "./product.api";

export interface Recipe {
  recipe_id: string;
  product_id: string;
  product_info?: Product;
  version: number;
  active: boolean;
}

export interface RecipePayload {
  product_id: string;
  version: number;
  active: boolean;
}

export const getRecipes = async (payload: {
  start: number;
  limit: number;
  name: string;
  product_id: string;
}) => (await api.post<ApiResponse<Recipe[]>>("/recipes/list", payload)).data;

export const getProductRecipeUsage = async (productIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/recipes/product-usage",
      { product_ids: productIDs },
    )
  ).data;

export const createRecipe = async (payload: RecipePayload) =>
  (await api.post<ApiResponse<null>>("/recipes/", payload)).data;

export const updateRecipe = async (recipeID: string, payload: RecipePayload) =>
  (await api.put<ApiResponse<null>>(`/recipes/${recipeID}`, payload)).data;

export const deleteRecipe = async (recipeID: string) =>
  (await api.delete<ApiResponse<null>>(`/recipes/${recipeID}`)).data;
