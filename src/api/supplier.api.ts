import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Supplier {
  supplier_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  link: string;
  active: boolean;
}

export interface SupplierPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  link: string;
  active: boolean;
}

export const getSuppliers = async (payload: {
  start: number;
  limit: number;
  name: string;
}) =>
  (await api.post<ApiResponse<Supplier[]>>("/suppliers/list", payload)).data;

export const getSupplierUsage = async (supplierIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>("/suppliers/usage", {
      supplier_ids: supplierIDs,
    })
  ).data;

export const createSupplier = async (payload: SupplierPayload) =>
  (await api.post<ApiResponse<null>>("/suppliers/", payload)).data;

export const updateSupplier = async (
  supplierID: string,
  payload: SupplierPayload,
) =>
  (await api.put<ApiResponse<null>>(`/suppliers/${supplierID}`, payload)).data;

export const deleteSupplier = async (supplierID: string) =>
  (await api.delete<ApiResponse<null>>(`/suppliers/${supplierID}`)).data;

export interface SupplierCatalogItem {
  ingredient_id: string;
  name: string;
  brand: string;
  packaging: string;
  content_qty: string;
  content_unit: string;
  price: string | null;
  effective_date: string | null;
  active: boolean;
}

export interface SupplierTransactionItem {
  ingredient_id: string;
  content_qty: string;
  content_unit: string;
  name: string;
  brand: string;
  quantity: string;
  unit: string;
  unit_price: string | null;
  total: string | null;
  notes: string;
}

export interface SupplierTransaction {
  delivery_date: string;
  payment_method: string;
  bank_account: string;
  ship_to: string;
  recipient: string;
  shipping_address: string;
  shipping_phone: string;
  transaction_id: string;
  source: "purchase" | "receipt" | "shopping";
  number: string;
  date: string;
  status: string;
  notes: string;
  total: string | null;
  created_by: string;
  items: SupplierTransactionItem[];
}

export interface SupplierHistory {
  transactions: SupplierTransaction[];
  total: number;
}

export interface PurchaseOrder {
  status: "PENDING" | "PARTIAL" | "RECEIVED";
  transaction_id: string;
  supplier_id: string;
  supplier_name: string;
  number: string;
  date: string;
  notes: string;
  total: string;
}

export const getPurchaseOrders = async (supplierID: string, start = 0, limit = 10, status = "", date = "") =>
  (await api.get<ApiResponse<{ orders: PurchaseOrder[]; total: number; status_counts: Record<PurchaseOrder["status"], number> }>>("/suppliers/purchase-orders", {
    params: { supplier_id: supplierID, start, limit, status, date },
  })).data;

export const getSupplier = async (supplierID: string) =>
  (
    await api.get<ApiResponse<Supplier>>(
      `/suppliers/${encodeURIComponent(supplierID)}`,
    )
  ).data;

export const getSupplierCatalog = async (supplierID: string) =>
  (
    await api.get<ApiResponse<SupplierCatalogItem[]>>(
      `/suppliers/${encodeURIComponent(supplierID)}/catalog`,
    )
  ).data;

export const getSupplierHistory = async (
  supplierID: string,
  start = 0,
  limit = 10,
  shoppingOnly = false,
) =>
  (
    await api.get<ApiResponse<SupplierHistory>>(
      `/suppliers/${encodeURIComponent(supplierID)}/${shoppingOnly ? "shopping" : "history"}`,
      { params: { start, limit } },
    )
  ).data;

export interface SupplierShoppingPayload {
  purchase_no: string;
  purchase_date: string;
  delivery_date: string;
  payment_method: string;
  bank_account: string;
  ship_to: string;
  recipient: string;
  shipping_address: string;
  shipping_phone: string;
  notes: string;
  items: {
    ingredient_id: string;
    description: string;
    quantity: string;
    unit_price: string;
  }[];
}
export const saveSupplierShopping = async (
  supplierID: string,
  payload: SupplierShoppingPayload,
  detailID?: string,
) => {
  const path = `/suppliers/${encodeURIComponent(supplierID)}/shopping`;
  return (
    detailID
      ? await api.put<ApiResponse<null>>(
          `${path}/${encodeURIComponent(detailID)}`,
          payload,
        )
      : await api.post<ApiResponse<null>>(path, payload)
  ).data;
};

export const getAllSuppliers = async () => {
  const items: Supplier[] = [];
  for (let start = 0; ;) {
    const response = await getSuppliers({start, limit: 100, name: ""});
    const page = response.data ?? [];
    items.push(...page);
    start += page.length;
    if (!page.length || start >= (response.total ?? start)) return items;
  }
};

export interface POReceiving {
  items: { item_id: string; name: string; ordered: string; received: string; remaining: string; packaging: string; unit_price: string; ordered_total: string; received_total: string }[];
  receipts: { receipt_id: string; date: string; total: string; notes: string }[];
}
export const getPOReceiving = async (supplierID: string, detailID: string) =>
  (await api.get<ApiResponse<POReceiving>>(`/suppliers/${encodeURIComponent(supplierID)}/shopping/${encodeURIComponent(detailID)}/receiving`)).data;
export const receivePO = async (supplierID: string, detailID: string, payload: {
  request_id: string; date: string; notes: string; items: { item_id: string; quantity: string }[];
}) => (await api.post<ApiResponse<{ receipt_id: string }>>(`/suppliers/${encodeURIComponent(supplierID)}/shopping/${encodeURIComponent(detailID)}/receiving`, payload)).data;
