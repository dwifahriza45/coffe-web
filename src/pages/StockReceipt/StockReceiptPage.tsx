import SupplierSelect from "../../components/suppliers/SupplierSelect";
import { isOpeningStockSubmitted } from "../../api/inventoryCount.api";
import { isAxiosError } from "axios";
import { ArrowLeft, ArrowRight, PackagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createStockReceipt,
  deleteStockReceipt,
  getStockReceipts,
  type StockReceipt,
  type StockReceiptPayload,
} from "../../api/stockReceipt.api";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";
import { currentBusinessDate } from "../../utils/businessDate";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: StockReceiptPayload = { supplier_name: "", notes: "" };

function formatDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("en-GB") : "-";
}

export default function StockReceiptPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const requiresOpening = roles.some((role) => ["admin", "leader"].includes(role));
  const [openingSubmitted, setOpeningSubmitted] = useState(false);
  const todayOnly = roles.includes("inventory") && !roles.some((role) => ["admin", "leader"].includes(role));
  const [searchParams] = useSearchParams();
  const businessDayID = todayOnly ? "" : searchParams.get("businessDayID") ?? "";
  const scopedDate = todayOnly ? currentBusinessDate() : businessDayID ? searchParams.get("date") ?? currentBusinessDate() : "";
  const contextQuery = businessDayID ? `?${new URLSearchParams({ businessDayID, date: scopedDate })}` : "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<StockReceipt[]>([]);
  const [activeBusinessDay, setActiveBusinessDay] = useState<BusinessDay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [supplierError, setSupplierError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StockReceiptPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    tone?: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    let current = true;
    async function loadReceipts() {
      setLoading(true);
      setError("");
      try {
        const response = await getStockReceipts({ start: (page - 1) * pageSize, limit: pageSize, name: search, receipt_date: scopedDate || receiptDate });
        if (!current) return;
        setItems(response.data ?? []);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
        setItems([]);
        setTotal(0);
        setError(response?.message || "Could not load stock receipts.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadReceipts();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, receiptDate, scopedDate, refreshKey]);

  useEffect(() => {
    let current = true;
    async function loadActiveBusinessDay() {
      setActiveBusinessDay(null);
      setOpeningSubmitted(false);
      try {
        const response = await getBusinessDays({ start: 0, limit: 1, status: "OPEN", business_date: scopedDate });
        if (!current) return;
        const day = response.data?.[0] ?? null;
        const submitted = day && requiresOpening ? await isOpeningStockSubmitted(day.business_day_id) : false;
        if (!current) return;
        setOpeningSubmitted(Boolean(submitted));
        setActiveBusinessDay(day && (!businessDayID || day.business_day_id === businessDayID) ? day : null);
      } catch {
        if (current) setActiveBusinessDay(null);
      }
    }
    void loadActiveBusinessDay();
    return () => {
      current = false;
    };
  }, [refreshKey, scopedDate, businessDayID, requiresOpening]);

  const canWrite = !requiresOpening || openingSubmitted;
  const canCreate = Boolean(activeBusinessDay) && canWrite;

  function openModal() {
    if (!canCreate) return;
    setNotice("");
    setSupplierError("");
    setForm(emptyForm);
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!form.supplier_name.trim()) { setSupplierError("Please select a supplier."); return; }
    if (!canCreate) {
      setError("Open a business day and submit Opening Stock before creating stock in.");
      return;
    }
    setConfirm({
      title: "Save stock in draft",
      message: "Save this stock in as a draft? You can add items and submit it from the detail page.",
      confirmText: "Save Draft",
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    if (!form.supplier_name.trim()) { setConfirm(null); setSupplierError("Please select a supplier."); return; }
    if (!canCreate) return;
    setConfirm(null);
    setSubmitting(true);
    try {
      await createStockReceipt(form);
      setNotice("Draft saved successfully.");
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
      setError(response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(item: StockReceipt) {
    if (!canWrite || item.status === "SUBMITTED" || item.has_items) return;
    setConfirm({
      title: "Delete stock in",
      message: "Delete this empty stock in record?",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteStockReceipt(item.stock_receipt_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
          setError(response?.message || "Could not delete stock receipt.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          {businessDayID && (
            <Link to={`/business-days/${businessDayID}/inventory-counts`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
              <ArrowLeft size={17} /> Stock Count
            </Link>
          )}
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#efe9df] text-[#8a5a3f]">
                <PackagePlus size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">Stock In</h1>
              <p className="mt-2 text-sm text-stone-500">{scopedDate ? formatDate(scopedDate) : "Track incoming inventory receipts and received items."}</p>
            </div>
            <button type="button" onClick={() => openModal()} disabled={!canCreate} title={!activeBusinessDay ? "Open a business day first" : !canWrite ? "Submit Opening Stock first" : "Add stock in"} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <Plus size={17} />
              Add stock in
            </button>
          </header>

          {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">Stock Receipts</h2>
                <p className="text-xs text-stone-500">{total} records found</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!scopedDate && <input type="date" value={receiptDate} onChange={(event) => { setPage(1); setReceiptDate(event.target.value); }} className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />}
                <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput); }} className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                  <Search size={17} className="text-stone-400" />
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search receipt..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </form>
              </div>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {!activeBusinessDay && <div className="m-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{scopedDate ? "Stock in can only be added when this business day is open." : "Open a business day before adding stock in."}</div>}
            {activeBusinessDay && !canWrite && <div className="m-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Submit Opening Stock before adding or changing stock in.</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-220 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Receipt</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Created By</th>
                    <th className="px-5 py-3">Created At</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-stone-500">Loading stock receipts...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-stone-500">No stock receipts yet</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.stock_receipt_id}>
                      <td className="px-5 py-4 text-sm">{formatDate(item.receipt_date)}</td>
                      <td className="px-5 py-4 text-sm font-semibold">{item.stock_receipt_id}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td>
                      <td className="px-5 py-4 text-sm">{item.supplier_name || "-"}</td>
                      <td className="px-5 py-4 text-sm">{item.created_by_info?.fullname ?? item.created_by}</td>
                      <td className="px-5 py-4 text-sm text-stone-600">{formatDateTime(item.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <Link to={`/stock-in/${item.stock_receipt_id}${contextQuery}`} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900" title="Open"><ArrowRight size={15} /></Link>
                          <button type="button" onClick={() => requestDelete(item)} disabled={!canWrite || item.status === "SUBMITTED" || item.has_items} className="disabled:cursor-not-allowed disabled:opacity-40 grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50" title={item.has_items ? "Remove all items before deleting this stock in" : "Delete"}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-stone-500">Page {page} of {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  Limit
                  <select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700">
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
              </div>
            </footer>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">Add stock in</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Business Date
                <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
                  <p className="text-sm font-semibold text-stone-900">{formatDate(activeBusinessDay?.business_date)}</p>
                  <p className="mt-1 text-xs font-medium text-stone-500">Auto from current open business day</p>
                </div>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Supplier *
                <SupplierSelect value={form.supplier_name} onChange={(supplier_name) => { setForm((current) => ({ ...current, supplier_name })); setSupplierError(""); }} disabled={submitting} />
                {supplierError && <span role="alert" className="mt-2 block text-xs text-red-600">{supplierError}</span>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Notes
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Example: delivery received complete, invoice checked." className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />
              </label>
            </div>
            <footer className="flex flex-wrap justify-start gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button>
              <button type="submit" disabled={submitting || !canWrite} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save Draft"}</button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
