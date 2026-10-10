import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { RecipeCost } from "./recipe.api";
export interface SellingSource {recipe_id:string;product_name:string;category_name:string;version:string;price:string}
export interface SellingCalculation {base_hpp:string;components:{label:string;percent:string;amount:string}[];total_hpp:string;selling_price:string;surplus:string}
export interface SellingRow {used_in_orders?:boolean;active:boolean;id:string;period:string;revision:number;created_at:string;snapshot:{source:SellingSource;calculation:SellingCalculation;recipe_cost:RecipeCost}}
export const getSellingSources = async () => (await api.get<ApiResponse<SellingSource[]>>("/selling-price-hpp/sources")).data;
export const getSellingCost = async (id:string) => (await api.get<ApiResponse<RecipeCost>>(`/selling-price-hpp/sources/${encodeURIComponent(id)}/cost`)).data;
export const getSellingHistory = async (period:string,start:number) => (await api.get<ApiResponse<SellingRow[]>>("/selling-price-hpp/",{params:{period,start}})).data;
export const createSellingSnapshot = async (data:{request_id:string;period:string;recipe_id:string;percents:string[];selling_price:string}) => (await api.post<ApiResponse<SellingRow>>("/selling-price-hpp/",data)).data;

export const updateSellingSnapshot = async (id:string,data:{request_id:string;period:string;recipe_id:string;percents:string[];selling_price:string}) => (await api.put<ApiResponse<SellingRow>>(`/selling-price-hpp/${encodeURIComponent(id)}`,data)).data;
export const deleteSellingSnapshot = async (id:string) => (await api.delete(`/selling-price-hpp/${encodeURIComponent(id)}`)).data;

export const setSellingSnapshotActive = async (id:string,active:boolean) => (await api.patch(`/selling-price-hpp/${encodeURIComponent(id)}/active`,{active})).data;
