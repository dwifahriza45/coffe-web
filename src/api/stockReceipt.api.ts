import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface StockReceiptUserInfo {
  user_id: string;
  fullname: string;
}

export interface StockReceipt {
  has_items: boolean;
  status: "DRAFT" | "SUBMITTED";
  submitted_by?: string;
  submitted_by_info?: StockReceiptUserInfo;
  submitted_at?: string;
  stock_receipt_id: string;
  business_day_id: string;
  business_day_info?: {
    business_day_id: string;
    business_date: string;
    status: string;
  };
  receipt_date: string;
  supplier_name: string;
  notes: string;
  created_by: string;
  created_by_info?: StockReceiptUserInfo;
  created_at: string;
  updated_at: string;
}

export interface StockReceiptPayload {
  supplier_name: string;
  notes: string;
}

export const getStockReceipts = async (payload: {
  start: number;
  limit: number;
  name: string;
  receipt_date: string;
  business_day_id?: string;
  status?: "DRAFT" | "SUBMITTED";
}) => (await api.post<ApiResponse<StockReceipt[]>>("/stock-receipts/list", payload)).data;

export const getStockReceipt = async (stockReceiptID: string) =>
  (await api.get<ApiResponse<StockReceipt>>(`/stock-receipts/${stockReceiptID}`)).data;

export const createStockReceipt = async (payload: StockReceiptPayload) =>
  (await api.post<ApiResponse<null>>("/stock-receipts/", payload)).data;

export const updateStockReceipt = async (stockReceiptID: string, payload: StockReceiptPayload) =>
  (await api.put<ApiResponse<null>>(`/stock-receipts/${stockReceiptID}`, payload)).data;

export const deleteStockReceipt = async (stockReceiptID: string) =>
  (await api.delete<ApiResponse<null>>(`/stock-receipts/${stockReceiptID}`)).data;

export const saveStockReceiptDraft = async (stockReceiptID: string, payload: StockReceiptPayload) =>
  (await api.patch<ApiResponse<null>>(`/stock-receipts/${stockReceiptID}/draft`, payload)).data;

export const submitStockReceipt = async (stockReceiptID: string) =>
  (await api.patch<ApiResponse<null>>(`/stock-receipts/${stockReceiptID}/submit`, {})).data;

export async function getDraftStockReceiptCount(businessDayID: string) {
  const response = await getStockReceipts({ start: 0, limit: 1, name: "", receipt_date: "", business_day_id: businessDayID, status: "DRAFT" });
  return response.total ?? response.data?.length ?? 0;
}
