import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { getAllSuppliers, getPurchaseOrders, type Supplier, type PurchaseOrder } from "../../api/supplier.api";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { currentBusinessDate, formatBusinessDate } from "../../utils/businessDate";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";
import POReceivingPanel from "../SupplierDetail/POReceivingPanel";

const statuses = [{ key: "", label: "Semua status" }, { key: "PENDING", label: "Menunggu penerimaan" }, { key: "PARTIAL", label: "Diterima sebagian" }, { key: "RECEIVED", label: "Diterima semua" }] as const;

export default function PurchaseOrderPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierID, setSupplierID] = useState("");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState(currentBusinessDate);
  const [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState<Record<PurchaseOrder["status"], number>>({ PENDING: 0, PARTIAL: 0, RECEIVED: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    getAllSuppliers().then((items) => {
      if (!current) return;
      setSuppliers(items);
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
    getPurchaseOrders(supplierID, (page - 1) * 10, 10, status, date).then((response) => {
      if (!current) return;
      setOrders(response.data?.orders ?? []);
      setTotal(response.data?.total ?? 0);
      setCounts(response.data?.status_counts ?? { PENDING: 0, PARTIAL: 0, RECEIVED: 0 });
    }).catch(() => { if (current) setError("Gagal memuat purchase order."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [supplierID, page, status, date, refresh]);
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
              Tanggal PO
              <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" />
            </label>
            {date && <button type="button" onClick={() => { setDate(""); setPage(1); }} className="text-sm font-semibold text-brand-primary hover:underline">Semua tanggal</button>}
          {selected && <Link to={`/supplier-management/${encodeURIComponent(supplierID)}`} className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white">Buka supplier / buat PO</Link>}
          </div>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : loading ? <p>Memuat purchase order...</p> : !orders.length ? <p className="rounded-2xl border border-stone-200 bg-white p-8 text-stone-500">{selected ? "Belum ada purchase order untuk supplier ini." : "Belum ada purchase order."}</p> : <>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Daftar purchase order. Klik nomor PO atau baris untuk membuka detail penerimaan.</caption>
              <thead className="bg-brand-soft text-stone-600">
                <tr>
                  <th scope="col" className="px-5 py-4">Nomor PO</th>
                  <th scope="col" className="px-5 py-4">Tanggal</th>
                  <th scope="col" className="px-5 py-4">Supplier</th>
                  <th scope="col" className="px-5 py-4">Status penerimaan</th>
                  <th scope="col" className="px-5 py-4 text-right">Total pesanan</th>
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
                      <td className="px-5 py-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${order.status === "RECEIVED" ? "bg-green-100 text-green-800" : order.status === "PARTIAL" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {statuses.find((option) => option.key === order.status)?.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">Rp {new Intl.NumberFormat("id-ID").format(Number(order.total))}</td>
                    </tr>
                    <tr id={detailID} hidden={!open}>
                      <td colSpan={5} className="border-t border-stone-200 bg-stone-50/50 p-5">
                        {open && <>
                          {order.notes && <p className="mb-4 text-sm text-stone-500">{order.notes}</p>}
                          <POReceivingPanel supplierID={order.supplier_id} detailID={order.transaction_id} canReceive={userCan(user, "suppliers", "update")} onReceived={() => { setPage(1); setRefresh((value) => value + 1); }} />
                          <Link to={`/supplier-management/${encodeURIComponent(order.supplier_id)}`} className="mt-4 inline-block text-sm font-semibold text-brand-primary underline">Lihat detail pesanan di supplier</Link>
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
  </div>;
}
