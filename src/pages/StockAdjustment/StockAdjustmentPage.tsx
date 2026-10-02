import { isOpeningStockSubmitted } from "../../api/inventoryCount.api";
import { isAxiosError } from "axios";
import { ArrowLeft, ArrowRight, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import {
  createStockAdjustment,
  deleteStockAdjustment,
  getStockAdjustments,
  type StockAdjustment,
  type StockAdjustmentPayload,
} from "../../api/stockAdjustment.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { getUserRoleNames } from "../../app/roleAccess";
import { currentBusinessDate } from "../../utils/businessDate";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: StockAdjustmentPayload = { reason: "", notes: "" };

function formatDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

function formatDateTime(value: string | undefined) {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

export default function StockAdjustmentPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const roles = getUserRoleNames(user);
  const requiresOpening = roles.some((role) => ["admin", "leader"].includes(role));
  const todayOnly = roles.includes("inventory") && !roles.some((role) => ["admin", "leader"].includes(role));
  const [searchParams] = useSearchParams();
  const businessDayID = todayOnly ? "" : searchParams.get("businessDayID") ?? "";
  const queryDate = searchParams.get("date") ?? "";
  const scopedDate = todayOnly ? currentBusinessDate() : businessDayID ? queryDate || currentBusinessDate() : queryDate;
  const contextQuery = businessDayID || scopedDate ? `?${new URLSearchParams({ ...(businessDayID ? { businessDayID } : {}), ...(scopedDate ? { date: scopedDate } : {}) })}` : "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<StockAdjustment[]>([]);
  const [activeBusinessDay, setActiveBusinessDay] = useState<BusinessDay | null>(null);
  const [openingSubmitted, setOpeningSubmitted] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StockAdjustmentPayload>(emptyForm);
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
    async function loadAdjustments() {
      setLoading(true);
      setError("");
      try {
        const response = await getStockAdjustments({ start: (page - 1) * pageSize, limit: pageSize, name: search, business_date: scopedDate || businessDate, business_day_id: businessDayID });
        if (!current) return;
        setItems(response.data ?? []);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
        setItems([]);
        setTotal(0);
        setError(response?.message || t("Could not load stock adjustments."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadAdjustments();
    return () => { current = false; };
  }, [page, pageSize, search, businessDate, scopedDate, businessDayID, refreshKey]);

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
    return () => { current = false; };
  }, [refreshKey, scopedDate, businessDayID, requiresOpening]);

  const canWrite = !requiresOpening || openingSubmitted;
  const canCreate = Boolean(activeBusinessDay) && canWrite;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function openModal() {
    if (!canCreate) return;
    setNotice("");
    setReasonError("");
    setForm(emptyForm);
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!form.reason.trim()) { setReasonError(t("Reason is required.")); return; }
    if (!canCreate) {
      setError(t("Open a business day and submit Opening Stock before creating stock adjustment."));
      return;
    }
    setConfirm({ title: t("Save stock adjustment draft"), message: t("Save this stock adjustment as a draft?"), confirmText: t("Save Draft"), onConfirm: submitConfirmed });
  }

  async function submitConfirmed() {
    if (!form.reason.trim() || !canCreate) return;
    setConfirm(null);
    setSubmitting(true);
    try {
      await createStockAdjustment(form);
      setNotice(t("Draft saved successfully."));
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
      setError(response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(item: StockAdjustment) {
    if (!canWrite || item.status === "SUBMITTED" || item.has_items) return;
    setConfirm({
      title: t("Delete stock adjustment"),
      message: t("Delete this empty stock adjustment record?"),
      confirmText: t("Delete"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteStockAdjustment(item.adjustment_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
          setError(response?.message || t("Could not delete stock adjustment."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          {businessDayID && <Link to={`/business-days/${businessDayID}/inventory-counts`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"><ArrowLeft size={17} /> {t("Stock Count")}</Link>}
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#efe9df] text-[#8a5a3f]"><SlidersHorizontal size={22} /></div>
              <h1 className="font-serif text-3xl font-bold">{t("Stock Adjustment")}</h1>
              <p className="mt-2 text-sm text-stone-500">{scopedDate ? formatDate(scopedDate) : t("Record approved inventory corrections.")}</p>
            </div>
            <button type="button" onClick={openModal} disabled={!canCreate} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <Plus size={17} /> {t("Add adjustment")}
            </button>
          </header>
          {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-semibold">{t("Stock Adjustments")}</h2><p className="text-xs text-stone-500">{total} {t("records found")}</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!scopedDate && <input type="date" value={businessDate} onChange={(event) => { setPage(1); setBusinessDate(event.target.value); }} className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />}
                <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput); }} className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                  <Search size={17} className="text-stone-400" />
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t("Search adjustment...")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </form>
              </div>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {!activeBusinessDay && <div className="m-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{scopedDate ? t("Stock adjustment can only be added when this business day is open.") : t("Open a business day before adding stock adjustment.")}</div>}
            {activeBusinessDay && !canWrite && <div className="m-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{t("Submit Opening Stock before adding or changing stock adjustment.")}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-220 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr>{["Date", "Adjustment", "Status", "Reason", "Created by", "Created At", "Action"].map((label) => <th key={label} className={`px-5 py-3 ${label === "Action" ? "text-right" : ""}`}>{t(label)}</th>)}</tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading stock adjustments...")}</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-stone-500">{t("No stock adjustments yet")}</td></tr> : items.map((item) => (
                    <tr key={item.adjustment_id}>
                      <td className="px-5 py-4 text-sm">{formatDate(item.business_date)}</td>
                      <td className="px-5 py-4 text-sm font-semibold">{item.adjustment_id}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status === "SUBMITTED" ? t("Submitted") : t("Draft")}</span></td>
                      <td className="max-w-xs whitespace-pre-wrap break-words px-5 py-4 text-sm">{item.reason}</td>
                      <td className="px-5 py-4 text-sm">{item.created_by_info?.fullname ?? item.created_by}</td>
                      <td className="px-5 py-4 text-sm text-stone-600">{formatDateTime(item.created_at)}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1.5"><Link to={`/stock-adjustments/${item.adjustment_id}${contextQuery}`} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900" title={t("Open")}><ArrowRight size={15} /></Link><button type="button" onClick={() => requestDelete(item)} disabled={!canWrite || item.status === "SUBMITTED" || item.has_items} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" title={item.has_items ? t("Remove all items before deleting this adjustment") : t("Delete")}><Trash2 size={15} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex items-center gap-3"><p className="text-xs text-stone-500">{t("Page")} {page} {t("of")} {totalPages}</p><label className="flex items-center gap-2 text-xs font-semibold text-stone-500">{t("Limit")}<select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700">{PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
              <div className="flex gap-2"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Previous")}</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Next")}</button></div>
            </footer>
          </section>
        </main>
      </section>
      {modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><form onSubmit={submitForm} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-stone-200 p-5"><h2 className="text-lg font-bold">{t("Add stock adjustment")}</h2><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-stone-700">{t("Business Date")}<div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3"><p className="text-sm font-semibold text-stone-900">{formatDate(activeBusinessDay?.business_date)}</p><p className="mt-1 text-xs font-medium text-stone-500">{t("Auto from current open business day")}</p></div></label><label className="block text-sm font-semibold text-stone-700">{t("Reason *")}<textarea value={form.reason} onChange={(event) => { setForm((current) => ({ ...current, reason: event.target.value })); setReasonError(""); }} required className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[#b86b42]" />{reasonError && <span role="alert" className="mt-2 block text-xs text-red-600">{reasonError}</span>}</label><label className="block text-sm font-semibold text-stone-700">{t("Notes")}<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42]" /></label></div><footer className="flex flex-wrap justify-start gap-3 border-t border-stone-200 p-5"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Cancel")}</button><button type="submit" disabled={submitting || !canCreate} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? t("Saving...") : t("Save Draft")}</button></footer></form></div>}
      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? t("Confirm")} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
