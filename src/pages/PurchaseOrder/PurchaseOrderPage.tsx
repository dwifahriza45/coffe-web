import PurchaseOrderDetail from "./PurchaseOrderDetail";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {isAxiosError} from "axios";
import CreatePurchaseOrder from "./CreatePurchaseOrder";
import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ClipboardList, Plus, Trash2 } from "lucide-react";
import { getPOSupplierChoices, getPurchaseOrders, deletePurchaseOrder, type Supplier, type PurchaseOrder } from "../../api/supplier.api";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { formatBusinessDate } from "../../utils/businessDate";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";
import POReceivingPanel from "../SupplierDetail/POReceivingPanel";

function currentMonthRange(){
 const now=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const year=Number(now.find(part=>part.type==="year")?.value),month=Number(now.find(part=>part.type==="month")?.value);
 const prefix=`${year}-${String(month).padStart(2,"0")}`;
 return {start:`${prefix}-01`,end:`${prefix}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`};
}
const statuses = [{ key: "", label: "Semua status" }, { key: "PENDING", label: "Menunggu penerimaan" }, { key: "PARTIAL", label: "Diterima sebagian" }, { key: "RECEIVED", label: "Diterima semua" }] as const;

export default function PurchaseOrderPage() {
  const { user } = useAuth();
  const [params,setParams]=useSearchParams();
  const focusedOrder=params.get("order_id")||"";
  const canDelete=userCan(user,"purchase_orders","delete");
  const [deleteTarget,setDeleteTarget]=useState<PurchaseOrder|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Pick<Supplier,"supplier_id"|"name">[]>([]);
  const [supplierID, setSupplierID] = useState(()=>params.get("supplier_id")||"");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [startDate,setStartDate]=useState(()=>params.get("start_date")||currentMonthRange().start);
  const [endDate,setEndDate]=useState(()=>params.get("end_date")||currentMonthRange().end);
  const [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState<Record<PurchaseOrder["status"], number>>({ PENDING: 0, PARTIAL: 0, RECEIVED: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(()=>{
    setSupplierID(params.get("supplier_id")||"");setStartDate(params.get("start_date")||currentMonthRange().start);setEndDate(params.get("end_date")||currentMonthRange().end);setStatus("");setPage(1);const order=params.get("order_id");setExpanded(order?{[order]:true}:{});
  },[params]);
  useEffect(() => {
    let current = true;
    getPOSupplierChoices().then((response) => {
      if (!current) return;
      setSuppliers(response.data||[]);
    }).catch(() => {
      if (current) setError("Gagal memuat supplier.");
    });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setOrders([]);
    setTotal(0);
    if(startDate&&endDate&&startDate>endDate){setError("Tanggal mulai tidak boleh melewati tanggal akhir.");setLoading(false);return;}
    getPurchaseOrders(supplierID, (page - 1) * 10, 10, status, startDate, endDate, focusedOrder).then((response) => {
      if (!current) return;
      setOrders(response.data?.orders ?? []);
      setTotal(response.data?.total ?? 0);
      setCounts(response.data?.status_counts ?? { PENDING: 0, PARTIAL: 0, RECEIVED: 0 });
    }).catch(() => { if (current) setError("Gagal memuat purchase order."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [supplierID, page, status, startDate, endDate, refresh, focusedOrder]);
  async function confirmDelete(){
    if(!deleteTarget||deleting||!canDelete)return;
    setDeleting(true);setError("");setNotice("");
    try{await deletePurchaseOrder(deleteTarget.supplier_id,deleteTarget.transaction_id);setDeleteTarget(null);if(orders.length===1&&page>1)setPage(value=>value-1);setRefresh(value=>value+1);setNotice("PO berhasil dihapus.")}
    catch(e){setDeleteTarget(null);setError(isAxiosError<{message?:string}>(e)?e.response?.data?.message||"Gagal menghapus PO.":"Gagal menghapus PO.")}
    finally{setDeleting(false)}
  }
  const selected = suppliers.find((supplier) => supplier.supplier_id === supplierID);
  const pages = Math.max(1, Math.ceil(total / 10));
  return <div className="flex min-h-screen bg-brand-cream">
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <section className="min-w-0 flex-1">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <main className="space-y-6 p-5 sm:p-8">
        <header>
          <ClipboardList className="mb-4 text-brand-primary" size={32} />
          <h1 className="font-serif text-4xl font-bold text-brand-primary">Purchase Order</h1>
          <p className="mt-2 text-stone-500">Pilih supplier untuk melihat pesanan dan mencatat barang yang diterima.</p>
        </header>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter supplier">
          {[{ supplier_id: "", name: "Semua supplier" }, ...suppliers].map((supplier) => <button
            key={supplier.supplier_id}
            type="button"
            aria-pressed={supplierID === supplier.supplier_id}
            onClick={() => { setSupplierID(supplier.supplier_id); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${supplierID === supplier.supplier_id ? "bg-brand-primary text-brand-cream" : "bg-brand-soft text-brand-primary hover:bg-brand-sage"}`}
          >{supplier.name}</button>)}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter status PO">
          {statuses.map((option) => <button key={option.key} type="button" aria-pressed={status === option.key}
            onClick={() => { setStatus(option.key); setPage(1); }}
            className={`rounded-full border border-brand-primary px-4 py-2 text-sm transition-colors ${status === option.key ? "bg-brand-primary text-brand-cream" : "text-brand-primary hover:bg-brand-soft"}`}>
            {option.label} · {loading ? "…" : option.key ? counts[option.key] : counts.PENDING + counts.PARTIAL + counts.RECEIVED}
          </button>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-brand-primary">{selected ? `PO ${selected.name}` : "Semua purchase order"}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-600">
              Mulai
              <input type="date" value={startDate} max={endDate||undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-600">Akhir<input type="date" value={endDate} min={startDate||undefined} onChange={event=>{setEndDate(event.target.value);setPage(1)}} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"/></label>
            <button type="button" onClick={()=>{const range=currentMonthRange();setStartDate(range.start);setEndDate(range.end);setPage(1)}} className="text-sm font-semibold text-brand-primary hover:underline">Bulan ini</button>
            {(startDate||endDate)&&<button type="button" onClick={()=>{setStartDate("");setEndDate("");setPage(1)}} className="text-sm font-semibold text-brand-primary hover:underline">Semua tanggal</button>}
          {userCan(user,"purchase_orders","create")&&<button type="button" disabled={!selected} onClick={()=>{setNotice("");setCreating(true)}} title={selected?"Buat purchase order":"Pilih supplier terlebih dahulu"} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"><Plus size={18}/>Tambah PO</button>}
          {selected && userCan(user,"suppliers") && <Link to={`/supplier-management/${encodeURIComponent(supplierID)}`} className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white">Buka supplier / buat PO</Link>}
          </div>
        </div>
        {userCan(user,"purchase_orders","create")&&!selected&&<p className="text-sm text-stone-500">Pilih supplier di atas untuk membuat PO baru.</p>}
        {focusedOrder&&<div className="flex items-center justify-between rounded-xl border border-brand-sage bg-white p-4 text-sm"><span>Detail PO yang dipilih dari Supplier</span><button onClick={()=>setParams({supplier_id:supplierID})} className="font-semibold text-brand-primary hover:underline">Lihat semua PO supplier</button></div>}
        {notice&&<p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{notice}</p>}
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : loading ? <p>Memuat purchase order...</p> : !orders.length ? <p className="rounded-2xl border border-stone-200 bg-white p-8 text-stone-500">{selected ? "Belum ada purchase order untuk supplier ini." : "Belum ada purchase order."}</p> : <>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Daftar purchase order. Klik nomor PO atau baris untuk membuka detail penerimaan.</caption>
              <thead className="bg-brand-soft text-stone-600">
                <tr>
                  <th scope="col" className="px-5 py-4">Nomor PO</th>
                  <th scope="col" className="px-5 py-4">Tanggal</th>
                  <th scope="col" className="px-5 py-4">Supplier</th>
                  <th scope="col" className="px-5 py-4">Dibuat oleh</th>
                  <th scope="col" className="px-5 py-4">Status penerimaan</th>
                  <th scope="col" className="px-5 py-4 text-right">Total pesanan</th>
                  {canDelete&&<th scope="col" className="w-20 px-5 py-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const open = !!expanded[order.transaction_id];
                  const toggle = () => setExpanded((previous) => ({ ...previous, [order.transaction_id]: !previous[order.transaction_id] }));
                  const detailID = `po-detail-${order.transaction_id}`;
                  return <Fragment key={order.transaction_id}>
                    <tr onClick={toggle} className={`cursor-pointer border-t border-stone-200 transition-colors hover:bg-brand-soft/50 ${open ? "bg-brand-soft/40" : ""}`}>
                      <th scope="row" className="px-5 py-4">
                        <button type="button" aria-expanded={open} aria-controls={detailID}
                          onClick={(event) => { event.stopPropagation(); toggle(); }}
                          className="flex items-center gap-2 rounded text-left font-semibold text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary">
                          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                          {order.number}
                        </button>
                      </th>
                      <td className="whitespace-nowrap px-5 py-4 text-stone-500">{formatBusinessDate(order.date)}</td>
                      <td className="px-5 py-4">{order.supplier_name}</td>
                      <td className="px-5 py-4"><p className="font-semibold">{order.created_by_name||"Tidak tercatat"}</p><p className="mt-1 text-xs text-stone-500">{new Date(order.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"short",timeStyle:"short"})} WIB</p></td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${order.status === "RECEIVED" ? "bg-green-100 text-green-800" : order.status === "PARTIAL" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {statuses.find((option) => option.key === order.status)?.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">Rp {new Intl.NumberFormat("id-ID").format(Number(order.total))}</td>
                      {canDelete&&<td className="px-5 py-4 text-right"><button type="button" disabled={order.status!=="PENDING"||deleting} onClick={event=>{event.stopPropagation();setDeleteTarget(order)}} aria-label={`Hapus PO ${order.number}`} title={order.status==="PENDING"?"Hapus PO":"PO yang sudah diterima tidak bisa dihapus"} className="inline-flex rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"><Trash2 size={18}/></button></td>}
                    </tr>
                    <tr id={detailID} hidden={!open}>
                      <td colSpan={canDelete?7:6} className="border-t border-stone-200 bg-stone-50/50 p-5">
                        {open && <>
                          {order.notes && <p className="mb-4 text-sm text-stone-500">{order.notes}</p>}
                          <POReceivingPanel supplierID={order.supplier_id} detailID={order.transaction_id} canReceive={userCan(user, "purchase_orders", "update")} onReceived={() => { setPage(1); setRefresh((value) => value + 1); }} />
                          <PurchaseOrderDetail supplierID={order.supplier_id} detailID={order.transaction_id} status={order.status} onUpdated={()=>setRefresh(value=>value+1)}/>
                        </>}
                      </td>
                    </tr>
                  </Fragment>;
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{total} PO · Halaman {page} dari {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-stone-200 px-4 py-2 disabled:opacity-40">Sebelumnya</button>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-stone-200 px-4 py-2 disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        </>}
      </main>
    </section>
    <ConfirmDialog open={!!deleteTarget} title="Hapus purchase order" message={`Hapus ${deleteTarget?.number||"PO ini"}? Hanya PO yang belum pernah diterima yang bisa dihapus.`} confirmText="Hapus PO" tone="danger" submitting={deleting} onCancel={()=>{if(!deleting)setDeleteTarget(null)}} onConfirm={()=>void confirmDelete()}/>
    {creating&&selected&&<CreatePurchaseOrder supplierID={selected.supplier_id} onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false);setStatus("");setPage(1);setRefresh(v=>v+1);setNotice("PO berhasil dibuat. Stok bertambah setelah barang diterima.")}}/>}
  </div>;
}
