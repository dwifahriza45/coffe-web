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
  counted_by: string;
  counted_by_info?: BusinessDayUserInfo;
  counted_at: string;
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
