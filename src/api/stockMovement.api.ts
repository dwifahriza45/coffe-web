import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface StockMovement {
  stock_movement_id: string;
  business_day_id: string;
  business_date: string;
  ingredient_id: string;
  ingredient_name: string;
  base_unit: string;
  unit_code: string;
  movement_type: string;
  quantity: string;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export const getStockMovements = async (payload: {
  start: number; limit: number; business_day_id: string; business_date: string;
  movement_type: string; name: string; ingredient_id?: string;
}) => (await api.post<ApiResponse<StockMovement[]>>("/stock-movements/list", payload)).data;
