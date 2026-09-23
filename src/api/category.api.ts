import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Category {
  category_id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface CategoryPayload {
  name: string;
  description: string;
  active: boolean;
}

export const getCategories = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<Category[]>>("/categories/list", payload)).data;

export const getCategory = async (categoryID: string) =>
  (await api.get<ApiResponse<Category>>(`/categories/${categoryID}`)).data;

export const createCategory = async (payload: CategoryPayload) =>
  (await api.post<ApiResponse<null>>("/categories/", payload)).data;

export const updateCategory = async (categoryID: string, payload: CategoryPayload) =>
  (await api.put<ApiResponse<null>>(`/categories/${categoryID}`, payload)).data;

export const deleteCategory = async (categoryID: string) =>
  (await api.delete<ApiResponse<null>>(`/categories/${categoryID}`)).data;
