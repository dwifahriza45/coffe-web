import api from "./client";
import type { ApiResponse } from "../types/auth";
export interface OrderCategory {category_id:string;name:string;menu_count:number}
export interface OrderCatalogItem {product_id:string;recipe_id:string;price_snapshot_id:string;name:string;category_id:string;category_name:string;description:string;image_url:string;version:string;selling_price:string;ready:boolean;max_quantity:number;stock_date:string}
export interface CartRequestItem {recipe_id:string;price_snapshot_id:string;quantity:number}
export interface OrderLine {recipe_id:string;price_snapshot_id:string;name:string;version:string;quantity:number;unit_price:string;total:string}
export interface OrderQuote {items:OrderLine[];total:string;business_date:string}
export type OrderStatus="WAITING"|"PROCESSING"|"COMPLETED";
export interface OrderReceipt {status:OrderStatus;id:string;order_number:string;items:OrderLine[];total:string;business_date:string}
export const getOrderCategories=async()=>(await api.get<ApiResponse<OrderCategory[]>>("/orders/categories")).data;
export const getOrderCatalog=async(payload:{start:number;limit:number;name:string;category_id:string})=>(await api.post<ApiResponse<OrderCatalogItem[]>>("/orders/catalog",payload)).data;
export const quoteOrder=async(items:CartRequestItem[])=>(await api.post<ApiResponse<OrderQuote>>("/orders/quote",{items})).data;
export const checkoutOrder=async(request_id:string,items:CartRequestItem[])=>(await api.post<ApiResponse<OrderReceipt>>("/orders/checkout",{request_id,items})).data;
export interface HistoryOrder extends OrderReceipt {created_by:string;created_at:string;item_count:number}
export const getOrderHistory=async(payload:{start:number;limit:number;date:string;search:string})=>(await api.post<ApiResponse<HistoryOrder[]>>("/orders/history",payload)).data;
export const getOrderHistoryDetail=async(id:string)=>(await api.get<ApiResponse<HistoryOrder>>(`/orders/history/${id}`)).data;

export const updateOrderStatus=async(id:string,expected_status:OrderStatus,status:OrderStatus)=>(await api.patch<ApiResponse<HistoryOrder>>(`/orders/history/${id}/status`,{expected_status,status})).data;
