import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface BrandType {
  subcategory_ingredient_id: string;
  brand_type_id: string;
  category_ingredient_id: string;
  name: string;
  active: boolean;
}

export interface BrandTypePayload {
  subcategory_ingredient_id?: string;
  category_ingredient_id: string;
  name: string;
  active: boolean;
}

export const getBrandTypes = async (payload: {
  start: number;
  limit: number;
  name: string;
  category_ingredient_id?: string;
  subcategory_ingredient_id?: string;
}) =>
  (await api.post<ApiResponse<BrandType[]>>("/brand-types/list", payload)).data;

export const getBrandTypeUsage = async (brandTypeIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>("/brand-types/usage", {
      brand_type_ids: brandTypeIDs,
    })
  ).data;

export const createBrandType = async (payload: BrandTypePayload) =>
  (await api.post<ApiResponse<null>>("/brand-types/", payload)).data;

export const updateBrandType = async (
  brandTypeID: string,
  payload: BrandTypePayload,
) =>
  (await api.put<ApiResponse<null>>(`/brand-types/${brandTypeID}`, payload))
    .data;

export const deleteBrandType = async (brandTypeID: string) =>
  (await api.delete<ApiResponse<null>>(`/brand-types/${brandTypeID}`)).data;

export const getAllBrandTypes = async (categoryIngredientID = "") => {
  const items: BrandType[] = [];
  for (let start = 0; ;) {
    const response = await getBrandTypes({
      start,
      limit: 100,
      name: "",
      category_ingredient_id: categoryIngredientID,
    });
    const page = response.data ?? [];
    items.push(...page);
    start += page.length;
    if (!page.length || start >= (response.total ?? start)) return items;
  }
};
