import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { Ingredient } from "./ingredient.api";
import type { StockReceipt } from "./stockReceipt.api";

export interface StockReceiptItem {
  stock_receipt_item_id: string;
  stock_receipt_id: string;
  stock_receipt_info?: StockReceipt;
  ingredient_id: string;
  ingredient_info?: Ingredient;
  quantity: string;
  notes: string;
}

export interface StockReceiptItemPayload {
  stock_receipt_id: string;
  ingredient_id: string;
  quantity: string;
  notes: string;
}

export const getStockReceiptItems = async (payload: {
  start: number;
  limit: number;
  stock_receipt_id: string;
  ingredient_id: string;
  name: string;
}) => (await api.post<ApiResponse<StockReceiptItem[]>>("/stock-receipt-items/list", payload)).data;

export const createStockReceiptItem = async (payload: StockReceiptItemPayload) =>
  (await api.post<ApiResponse<null>>("/stock-receipt-items/", payload)).data;

export const updateStockReceiptItem = async (stockReceiptItemID: string, payload: StockReceiptItemPayload) =>
  (await api.put<ApiResponse<null>>(`/stock-receipt-items/${stockReceiptItemID}`, payload)).data;

export const deleteStockReceiptItem = async (stockReceiptItemID: string) =>
  (await api.delete<ApiResponse<null>>(`/stock-receipt-items/${stockReceiptItemID}`)).data;
