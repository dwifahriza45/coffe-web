import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Supplier {
  supplier_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface SupplierPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export const getSuppliers = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<Supplier[]>>("/suppliers/list", payload)).data;

export const createSupplier = async (payload: SupplierPayload) =>
  (await api.post<ApiResponse<null>>("/suppliers/", payload)).data;

export const updateSupplier = async (supplierID: string, payload: SupplierPayload) =>
  (await api.put<ApiResponse<null>>(`/suppliers/${supplierID}`, payload)).data;

export const deleteSupplier = async (supplierID: string) =>
  (await api.delete<ApiResponse<null>>(`/suppliers/${supplierID}`)).data;
