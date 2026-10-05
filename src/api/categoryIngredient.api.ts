import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface CategoryIngredient {
  category_ingredient_id: string;
  name: string;
  active: boolean;
}

export interface CategoryIngredientPayload {
  name: string;
  active: boolean;
}

export const getCategoryIngredients = async (payload: {
  start: number;
  limit: number;
  name: string;
}) =>
  (
    await api.post<ApiResponse<CategoryIngredient[]>>(
      "/category-ingredients/list",
      payload,
    )
  ).data;

export const getCategoryIngredientUsage = async (
  categoryIngredientIDs: string[],
) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/category-ingredients/usage",
      {
        category_ingredient_ids: categoryIngredientIDs,
      },
    )
  ).data;

export const createCategoryIngredient = async (
  payload: CategoryIngredientPayload,
) =>
  (await api.post<ApiResponse<null>>("/category-ingredients/", payload)).data;

export const updateCategoryIngredient = async (
  categoryIngredientID: string,
  payload: CategoryIngredientPayload,
) =>
  (
    await api.put<ApiResponse<null>>(
      `/category-ingredients/${categoryIngredientID}`,
      payload,
    )
  ).data;

export const deleteCategoryIngredient = async (categoryIngredientID: string) =>
  (
    await api.delete<ApiResponse<null>>(
      `/category-ingredients/${categoryIngredientID}`,
    )
  ).data;

export const getAllCategoryIngredients = async () => {
  const items: CategoryIngredient[] = [];
  for (let start = 0; ;) {
    const response = await getCategoryIngredients({
      start,
      limit: 100,
      name: "",
    });
    const page = response.data ?? [];
    items.push(...page);
    start += page.length;
    if (!page.length || start >= (response.total ?? start)) return items;
  }
};

export interface IngredientSubcategory {
  subcategory_ingredient_id: string;
  category_ingredient_id: string;
  name: string;
  active: boolean;
  in_use: boolean;
}
export const getIngredientSubcategories = async (categoryID = "") =>
  (
    await api.get<ApiResponse<IngredientSubcategory[]>>(
      categoryID
        ? `/category-ingredients/${encodeURIComponent(categoryID)}/subcategories`
        : "/category-ingredients/subcategories",
    )
  ).data;
export const getCategoryIngredient = async (categoryID: string) =>
  (
    await api.get<ApiResponse<CategoryIngredient>>(
      `/category-ingredients/${encodeURIComponent(categoryID)}`,
    )
  ).data;
export const saveIngredientSubcategory = async (
  categoryID: string,
  payload: CategoryIngredientPayload,
  subcategoryID?: string,
) => {
  const path = `/category-ingredients/${encodeURIComponent(categoryID)}/subcategories`;
  return (
    subcategoryID
      ? await api.put<ApiResponse<null>>(
          `${path}/${encodeURIComponent(subcategoryID)}`,
          payload,
        )
      : await api.post<ApiResponse<null>>(path, payload)
  ).data;
};
export const deleteIngredientSubcategory = async (
  categoryID: string,
  subcategoryID: string,
) =>
  (
    await api.delete<ApiResponse<null>>(
      `/category-ingredients/${encodeURIComponent(categoryID)}/subcategories/${encodeURIComponent(subcategoryID)}`,
    )
  ).data;
