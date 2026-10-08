import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Product } from "./product.api";

export interface Recipe {
  recipe_id: string;
  product_id: string;
  recipe_category?: string;
  product_info?: Product;
  version: string;
  active: boolean;
  is_base?: boolean;
  serving_quantity?: string;
  yield_quantity?: string;
  initial_quantity?: string;
  yield_unit?: string;
}

export interface RecipePayload {
  components?: { ingredient_id: string; base_recipe_id: string; quantity: string }[];
  product_id: string;
  recipe_category?: string;
  version: string;
  active: boolean;
  is_base?: boolean;
  serving_quantity?: string;
  yield_quantity?: string;
  initial_quantity?: string;
  yield_unit?: string;
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

export interface RecipeIngredient {
  ingredient_id: string;
  name: string;
  active: boolean;
  eligible: boolean;
  recipe_category: string;
  category_ingredient_id: string;
  category_ingredient_name: string;
  base_unit: string;
  unit_code: string;
}
export interface RecipeReadiness {
  stock_date: string;
  recipe_id: string;
  product_id: string;
  ready: boolean;
  reasons: string[];
  requirements: {
    ingredient_id: string;
    name: string;
    unit: string;
    required_quantity: string;
    available_quantity: string | null;
    ready: boolean;
  }[];
}
export const getRecipeIngredients = async () =>
  (await api.get<ApiResponse<RecipeIngredient[]>>("/recipes/ingredients")).data;
export const getRecipeReadiness = async (productIDs: string[] = [], date = "") =>
  (await api.post<ApiResponse<RecipeReadiness[]>>("/recipes/readiness", { product_ids: productIDs, date })).data;

export interface RecipeCost {
 recipe_id: string;
 complete: boolean;
 total_cost: string | null;
 unit_cost: string | null;
 yield_quantity: string;
 yield_unit: string;
 initial_unit: string;
 initial_mixed: boolean;
 initial_quantity: string;
 waste_quantity: string | null;
 issues: string[];
 components: {
  ingredient_id: string;
  base_recipe_id: string;
  name: string;
  quantity: string;
  unit: string;
  purchase_price: string | null;
  purchase_quantity: string | null;
  purchase_unit: string | null;
  unit_cost: string | null;
  cost: string | null;
  issue?: string;
  price_option_id: string | null;
 }[];
}
export const getRecipeCost = async (recipeID: string) =>
 (await api.get<ApiResponse<RecipeCost>>(`/recipes/${encodeURIComponent(recipeID)}/cost`)).data;
