import api from "./client";
import type { ApiResponse } from "../types/auth";
export interface StockSnapshot {
 ingredient_id: string;
 current_quantity: string | null;
 opening_quantity: string | null;
 closing_quantity: string | null;
 stock_in: string;
 stock_out: string;
 adjustment: string;
 snapshot_date: string;
 snapshot_type: string;
 unit_code: string;
 unit_price: string | null;
 minimum_stock: string | null;
 target_stock: string | null;
 content_qty: string | null;
 package_qty: string | null;
 content_unit: string | null;
 packaging: string | null;
}
export const getStockSnapshot = async (date = "", ingredientID = "") =>
 (await api.get<ApiResponse<{ date: string; items: StockSnapshot[] }>>("/ingredients/stock-snapshot", { params: { date, ingredient_id: ingredientID } })).data;
