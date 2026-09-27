import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Ingredient } from "./ingredient.api";
import type { InventoryCount } from "./inventoryCount.api";

export interface InventoryCountItem {
  inventory_count_item_id: string;
  inventory_count_id: string;
  inventory_count_info?: InventoryCount;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  actual_quantity: string;
  notes: string;
}

export interface InventoryCountItemPayload {
  inventory_count_id: string;
  ingredient_id: string;
  actual_quantity: string;
  notes: string;
}

export const getInventoryCountItems = async (payload: {
  start: number;
  limit: number;
  inventory_count_id: string;
  ingredient_id: string;
  name: string;
}) => (await api.post<ApiResponse<InventoryCountItem[]>>("/inventory-count-items/list", payload)).data;

export const createInventoryCountItem = async (payload: InventoryCountItemPayload) =>
  (await api.post<ApiResponse<null>>("/inventory-count-items/", payload)).data;

export const updateInventoryCountItem = async (
  inventoryCountItemID: string,
  payload: InventoryCountItemPayload,
) => (await api.put<ApiResponse<null>>(`/inventory-count-items/${inventoryCountItemID}`, payload)).data;

export const deleteInventoryCountItem = async (inventoryCountItemID: string) =>
  (await api.delete<ApiResponse<null>>(`/inventory-count-items/${inventoryCountItemID}`)).data;
