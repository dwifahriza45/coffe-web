import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Ingredient } from "./ingredient.api";
import type { StockAdjustment } from "./stockAdjustment.api";

export type AdjustmentType = "IN" | "OUT";

export interface StockAdjustmentItem {
  adjustment_item_id: string;
  adjustment_id: string;
  adjustment_info?: StockAdjustment;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  adjustment_type: AdjustmentType;
  quantity: string;
  reason: string;
}

export interface StockAdjustmentItemPayload {
  adjustment_id: string;
  ingredient_id: string;
  adjustment_type: AdjustmentType | "";
  quantity: string;
  reason: string;
}

export const getStockAdjustmentItems = async (payload: {
  start: number;
  limit: number;
  adjustment_id: string;
  ingredient_id: string;
  name: string;
}) => (await api.post<ApiResponse<StockAdjustmentItem[]>>("/stock-adjustment-items/list", payload)).data;

export const createStockAdjustmentItem = async (payload: StockAdjustmentItemPayload) =>
  (await api.post<ApiResponse<null>>("/stock-adjustment-items/", payload)).data;

export const updateStockAdjustmentItem = async (adjustmentItemID: string, payload: StockAdjustmentItemPayload) =>
  (await api.put<ApiResponse<null>>(`/stock-adjustment-items/${adjustmentItemID}`, payload)).data;

export const deleteStockAdjustmentItem = async (adjustmentItemID: string) =>
  (await api.delete<ApiResponse<null>>(`/stock-adjustment-items/${adjustmentItemID}`)).data;
