import api from "./client";
import type { ApiResponse } from "../types/auth";
export interface OperationalCategory {category_id: string; name: string; description: string; product_count: number}
export interface OperationalProduct {product_id: string; category_id: string; category_name: string; name: string; description: string; image_url: string}
export interface OperationalRecipe {recipe_id: string; version: string; recipe_category: string; is_base: boolean; yield_quantity: string; yield_unit: string; items: {name: string; quantity: string; unit: string; base_recipe_id: string}[]}
export interface OperationalDetail {product: OperationalProduct; recipes: OperationalRecipe[]}
export const getOperationalCategories = async () => (await api.get<ApiResponse<OperationalCategory[]>>("/operational-menu/categories")).data;
export const getOperationalProducts = async (payload: {start: number; limit: number; name: string; category_id: string}) => (await api.post<ApiResponse<OperationalProduct[]>>("/operational-menu/list",payload)).data;
export const getOperationalDetail = async (id: string, base = false) => (await api.get<ApiResponse<OperationalDetail>>(`/operational-menu/${base ? "recipes" : "products"}/${encodeURIComponent(id)}`)).data;
