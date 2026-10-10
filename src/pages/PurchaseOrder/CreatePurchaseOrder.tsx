import {useEffect,useState} from "react";
import {isAxiosError} from "axios";
import {X} from "lucide-react";
import {getPOCatalog,getPOSupplierInfo,type Supplier,type SupplierCatalogItem,type SupplierTransaction} from "../../api/supplier.api";
import SupplierShoppingForm from "../SupplierDetail/SupplierShoppingForm";
export default function CreatePurchaseOrder({supplierID,editing,onClose,onSaved}:{supplierID:string;editing?:SupplierTransaction;onClose:()=>void;onSaved:()=>void}){
 const [supplier,setSupplier]=useState<Supplier|null>(null),[catalog,setCatalog]=useState<SupplierCatalogItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");Promise.all([getPOSupplierInfo(supplierID),getPOCatalog(supplierID)]).then(([info,items])=>{if(active){setSupplier(info.data);setCatalog(items.data||[]);if(!info.data?.active)setError("Supplier tidak aktif. Pilih supplier aktif untuk membuat PO.")}}).catch(e=>{if(active)setError(isAxiosError<{message?:string}>(e)?e.response?.data?.message||"Gagal memuat data PO.":"Gagal memuat data PO.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[supplierID]);
 if(!loading&&!error&&supplier)return <SupplierShoppingForm purchaseOrderMode editing={editing} supplierID={supplierID} supplier={supplier} catalog={catalog} onClose={onClose} onSaved={onSaved}/>;
 return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="new-po-heading" className="w-full max-w-md rounded-2xl bg-white p-5"><header className="mb-4 flex items-center justify-between"><h2 id="new-po-heading" className="text-lg font-bold">Tambah Purchase Order</h2><button aria-label="Tutup tambah PO" onClick={onClose} className="rounded-lg p-2"><X size={20}/></button></header>{error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>:<p role="status">Memuat data supplier dan bahan…</p>}</section></div>
}
