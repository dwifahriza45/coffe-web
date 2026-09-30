import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface StockAdjustmentUserInfo {
  user_id: string;
  fullname: string;
}

export interface StockAdjustment {
  has_items: boolean;
  status: "DRAFT" | "SUBMITTED";
  submitted_by?: string;
  submitted_by_info?: StockAdjustmentUserInfo;
  submitted_at?: string;
  adjustment_id: string;
  business_day_id: string;
  business_day_info?: {
    business_day_id: string;
    business_date: string;
    status: string;
  };
  business_date: string;
  reason: string;
  notes: string;
  created_by: string;
  created_by_info?: StockAdjustmentUserInfo;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustmentPayload {
  reason: string;
  notes: string;
}

export const getStockAdjustments = async (payload: {
  start: number;
  limit: number;
  name: string;
  business_date: string;
  business_day_id?: string;
  status?: "DRAFT" | "SUBMITTED";
}) => (await api.post<ApiResponse<StockAdjustment[]>>("/stock-adjustments/list", payload)).data;

export const getStockAdjustment = async (adjustmentID: string) =>
  (await api.get<ApiResponse<StockAdjustment>>(`/stock-adjustments/${adjustmentID}`)).data;

export const createStockAdjustment = async (payload: StockAdjustmentPayload) =>
  (await api.post<ApiResponse<null>>("/stock-adjustments/", payload)).data;

export const updateStockAdjustment = async (adjustmentID: string, payload: StockAdjustmentPayload) =>
  (await api.put<ApiResponse<null>>(`/stock-adjustments/${adjustmentID}`, payload)).data;

export const deleteStockAdjustment = async (adjustmentID: string) =>
  (await api.delete<ApiResponse<null>>(`/stock-adjustments/${adjustmentID}`)).data;

export const saveStockAdjustmentDraft = async (adjustmentID: string, payload: StockAdjustmentPayload) =>
  (await api.patch<ApiResponse<null>>(`/stock-adjustments/${adjustmentID}/draft`, payload)).data;

export const submitStockAdjustment = async (adjustmentID: string) =>
  (await api.patch<ApiResponse<null>>(`/stock-adjustments/${adjustmentID}/submit`, {})).data;

export async function getDraftStockAdjustmentCount(businessDayID: string) {
  const response = await getStockAdjustments({ start: 0, limit: 1, name: "", business_date: "", business_day_id: businessDayID, status: "DRAFT" });
  return response.total ?? response.data?.length ?? 0;
}
