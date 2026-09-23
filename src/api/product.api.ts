import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Category } from "./category.api";

export interface Product {
  product_id: string;
  category_id: string;
  category_info?: Category;
  name: string;
  description: string;
  price: string;
  image_url: string;
  active: boolean;
}

export interface ProductPayload {
  category_id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  active: boolean;
}

export const getProducts = async (payload: {
  start: number;
  limit: number;
  name: string;
  category_id: string;
}) => (await api.post<ApiResponse<Product[]>>("/products/list", payload)).data;

export const getProduct = async (productID: string) =>
  (await api.get<ApiResponse<Product>>(`/products/${productID}`)).data;

export const getProductCategoryUsage = async (categoryIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>(
      "/products/category-usage",
      { category_ids: categoryIDs },
    )
  ).data;

export const createProduct = async (payload: ProductPayload) =>
  (await api.post<ApiResponse<null>>("/products/", payload)).data;

export const updateProduct = async (productID: string, payload: ProductPayload) =>
  (await api.put<ApiResponse<null>>(`/products/${productID}`, payload)).data;

export const deleteProduct = async (productID: string) =>
  (await api.delete<ApiResponse<null>>(`/products/${productID}`)).data;
