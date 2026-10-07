import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { BusinessDayUserInfo } from "./businessDay.api";

export interface InventoryCountBusinessDayInfo {
  business_day_id: string;
  business_date: string;
  status: string;
}

export interface InventoryCount {
  inventory_count_id: string;
  business_day_id: string;
  business_day_info?: InventoryCountBusinessDayInfo;
  count_type: "OPENING" | "CLOSING";
  status: "DRAFT" | "SUBMITTED";
  counted_by?: string;
  counted_by_info?: BusinessDayUserInfo;
  counted_at?: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const getInventoryCounts = async (payload: {
  start: number;
  limit: number;
  business_day_id: string;
  count_type: string;
  status: string;
  name: string;
}) => (await api.post<ApiResponse<InventoryCount[]>>("/inventory-counts/list", payload)).data;

export const getInventoryCount = async (inventoryCountID: string) =>
  (await api.get<ApiResponse<InventoryCount>>(`/inventory-counts/${inventoryCountID}`)).data;

export const submitInventoryCount = async (inventoryCountID: string) =>
  (await api.patch<ApiResponse<null>>(`/inventory-counts/${inventoryCountID}/submit`, {})).data;

export const saveInventoryCountDraft = async (inventoryCountID: string, payload: { notes: string }) =>
  (await api.patch<ApiResponse<null>>(`/inventory-counts/${inventoryCountID}/draft`, payload)).data;

export async function isOpeningStockSubmitted(businessDayID: string) {
  if (!businessDayID) return false;
  const response = await getInventoryCounts({ start: 0, limit: 1, business_day_id: businessDayID, count_type: "OPENING", status: "SUBMITTED", name: "" });
  return (response.data ?? []).some((count) => count.business_day_id === businessDayID && count.count_type === "OPENING" && count.status === "SUBMITTED");
}

export interface StockCountSection {
 department: string; status: "DRAFT" | "SUBMITTED"; notes: string; counted_by: string; counted_at: string;
}
export interface StockCountBalance { minimum: string | null; target: string | null; package_qty: string | null; packaging: string | null; brand: string; content_qty: string; content_unit: string; item_id: string; opening: string | null; stock_in: string; stock_out: string; adjustment: string }
export const getStockCountSections = async (id: string) => (await api.get<ApiResponse<{sections: StockCountSection[]; balances: StockCountBalance[]}>>(`/inventory-counts/${encodeURIComponent(id)}/sections`)).data;
export const submitStockCountSection = async (id: string, department: string) => (await api.patch<ApiResponse<null>>(`/inventory-counts/${encodeURIComponent(id)}/sections/submit`, {department})).data;
export const saveStockCountSectionDraft = async (id: string, department: string, notes: string) => (await api.patch<ApiResponse<null>>(`/inventory-counts/${encodeURIComponent(id)}/sections/draft`, {department,notes})).data;

export const copyPreviousStockCountSection = async (id: string, department: string) => (await api.post<ApiResponse<{copied: number}>>(`/inventory-counts/${encodeURIComponent(id)}/sections/copy-previous`, {department})).data;
