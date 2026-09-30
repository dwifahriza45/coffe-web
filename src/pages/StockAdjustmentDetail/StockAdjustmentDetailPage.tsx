import { isOpeningStockSubmitted } from "../../api/inventoryCount.api";
import { isAxiosError } from "axios";
import { ArrowLeft, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getStockAdjustment, saveStockAdjustmentDraft, submitStockAdjustment, type StockAdjustment, type StockAdjustmentPayload } from "../../api/stockAdjustment.api";
import {
  createStockAdjustmentItem,
  deleteStockAdjustmentItem,
  getStockAdjustmentItems,
  updateStockAdjustmentItem,
  type AdjustmentType,
  type StockAdjustmentItem,
  type StockAdjustmentItemPayload,
} from "../../api/stockAdjustmentItem.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";
import { currentBusinessDate } from "../../utils/businessDate";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyItemForm: StockAdjustmentItemPayload = { adjustment_id: "", ingredient_id: "", adjustment_type: "", quantity: "", reason: "" };

const adjustmentTypeLabels: Record<AdjustmentType, string> = {
  IN: "Tambah Stok",
  OUT: "Kurangi Stok",
};

function formatDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

export default function StockAdjustmentDetailPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const requiresOpening = roles.some((role) => ["admin", "leader"].includes(role));
  const todayOnly = roles.includes("inventory") && !roles.some((role) => ["admin", "leader"].includes(role));
  const { adjustmentID = "" } = useParams();
  const [searchParams] = useSearchParams();
  const businessDayID = todayOnly ? "" : searchParams.get("businessDayID") ?? "";
  const scopedDate = todayOnly ? currentBusinessDate() : searchParams.get("date") ?? "";
  const contextQuery = businessDayID ? `?${new URLSearchParams({ businessDayID, date: scopedDate })}` : "";
  const loadedAdjustmentID = useRef("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
  const [items, setItems] = useState<StockAdjustmentItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [draft, setDraft] = useState<StockAdjustmentPayload>({ reason: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [openingSubmitted, setOpeningSubmitted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockAdjustmentItem | null>(null);
  const [form, setForm] = useState<StockAdjustmentItemPayload>(emptyItemForm);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const locked = adjustment?.status === "SUBMITTED";
  const canWrite = !loading && !submitting && adjustment?.status === "DRAFT" && (!requiresOpening || openingSubmitted);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    tone?: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    let current = true;
    async function loadDetail() {
      setLoading(true);
      setOpeningSubmitted(false);
      setError("");
      try {
        const [adjustmentResponse, itemResponse, ingredientResponse] = await Promise.all([
          getStockAdjustment(adjustmentID),
          getStockAdjustmentItems({ start: 0, limit: 100, adjustment_id: adjustmentID, ingredient_id: "", name: "" }),
          getIngredients({ start: 0, limit: 100, name: "" }),
        ]);
        if (!current) return;
        const submitted = requiresOpening ? await isOpeningStockSubmitted(adjustmentResponse.data?.business_day_id ?? "") : false;
        if (!current) return;
        setOpeningSubmitted(submitted);
        setAdjustment(adjustmentResponse.data ?? null);
        if (adjustmentResponse.data && loadedAdjustmentID.current !== adjustmentID) {
          loadedAdjustmentID.current = adjustmentID;
          setDraft({ reason: adjustmentResponse.data.reason, notes: adjustmentResponse.data.notes });
        }
        setItems(itemResponse.data ?? []);
        setIngredients((ingredientResponse.data ?? []).filter((ingredient) => ingredient.active));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
        setError(response?.message || "Could not load stock adjustment.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => { current = false; };
  }, [adjustmentID, refreshKey, requiresOpening]);

  async function saveAdjustment(submit = false) {
    if (!draft.reason.trim()) { setReasonError("Reason is required."); setNotice(""); return; }
    if (!canWrite) return;
    setConfirm(null);
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await saveStockAdjustmentDraft(adjustmentID, draft);
      if (submit) await submitStockAdjustment(adjustmentID);
      setNotice(submit ? "Stock adjustment submitted successfully." : "Draft saved successfully.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
      setError(response?.message || "Could not save stock adjustment.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestSubmitAdjustment() {
    if (!draft.reason.trim()) { setReasonError("Reason is required."); setNotice(""); return; }
    if (!canWrite) return;
    setConfirm({ title: "Submit stock adjustment", message: "Submit this stock adjustment? After submitting, this record, its items, and generated movements cannot be edited or deleted.", confirmText: "Submit", onConfirm: () => saveAdjustment(true) });
  }

  function openItemModal(item?: StockAdjustmentItem) {
    if (!canWrite) return;
    setEditingItem(item ?? null);
    setForm(item ? {
      adjustment_id: item.adjustment_id,
      ingredient_id: item.ingredient_id,
      adjustment_type: item.adjustment_type,
      quantity: item.quantity,
      reason: item.reason,
    } : { ...emptyItemForm, adjustment_id: adjustmentID, adjustment_type: "IN" });
    setModalOpen(true);
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !form.ingredient_id || !form.quantity || !form.adjustment_type) return;
    setConfirm({
      title: editingItem ? "Update item" : "Add item",
      message: editingItem ? "Update this adjustment item?" : "Add this adjustment item?",
      confirmText: editingItem ? "Update" : "Add item",
      onConfirm: submitItemConfirmed,
    });
  }

  async function submitItemConfirmed() {
    if (!canWrite) return;
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) await updateStockAdjustmentItem(editingItem.adjustment_item_id, form);
      else await createStockAdjustmentItem(form);
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
      setError(response?.message || "Could not save stock adjustment item.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(item: StockAdjustmentItem) {
    if (!canWrite) return;
    setConfirm({
      title: "Delete item",
      message: "Delete this adjustment item?",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteStockAdjustmentItem(item.adjustment_item_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
          setError(response?.message || "Could not delete item.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  if (todayOnly && adjustment && adjustment.business_date !== currentBusinessDate()) {
    return <Navigate to="/stock-adjustments" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={`/stock-adjustments${contextQuery}`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"><ArrowLeft size={17} /> Stock Adjustment</Link>
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#efe9df] text-[#8a5a3f]"><SlidersHorizontal size={22} /></div>
            <h1 className="font-serif text-3xl font-bold">Stock Adjustment</h1>
            <p className="mt-2 text-sm text-stone-500">{adjustment?.adjustment_id ?? adjustmentID}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-[100px_minmax(0,1fr)]"><span className="text-stone-500">Date</span><span className="font-medium">{formatDate(adjustment?.business_date)}</span></div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${locked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{adjustment?.status ?? "DRAFT"}</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">Submitted by {adjustment?.submitted_by_info?.fullname || adjustment?.submitted_by || "-"}</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">Submitted at {adjustment?.submitted_at ? new Date(adjustment.submitted_at).toLocaleString("en-GB") : "-"}</span>
            </div>
            <label className="mt-5 block text-sm font-semibold text-stone-700">Reason *<textarea value={draft.reason} onChange={(event) => { setDraft((current) => ({ ...current, reason: event.target.value })); setReasonError(""); }} disabled={!canWrite} className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[#b86b42] disabled:bg-stone-100" />{reasonError && <span role="alert" className="mt-2 block text-xs text-red-600">{reasonError}</span>}</label>
            <label className="mt-5 block text-sm font-semibold text-stone-700">Notes<textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} disabled={!canWrite} className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[#b86b42] disabled:bg-stone-100" /></label>
            <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void saveAdjustment()} disabled={!canWrite} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Save Draft</button><button type="button" onClick={requestSubmitAdjustment} disabled={!canWrite} className="rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Submit</button></div>
            {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
          </section>
          {!loading && !locked && requiresOpening && !openingSubmitted && <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Submit Opening Stock before adding or changing stock adjustment.</div>}
          {locked && <p className="mt-5 rounded-lg bg-stone-100 p-4 text-sm text-stone-600">This stock adjustment has been submitted and can no longer be changed.</p>}
          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 p-4"><div><h2 className="font-semibold">Adjustment Items</h2><p className="text-xs text-stone-500">{items.length} items</p></div><button type="button" onClick={() => openItemModal()} disabled={!canWrite} className="flex items-center gap-2 rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /> Add item</button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-170 text-left"><thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr><th className="px-5 py-3">Ingredient</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-stone-100">{loading ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">Loading items...</td></tr> : items.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">No items yet</td></tr> : items.map((item) => <tr key={item.adjustment_item_id}><td className="px-5 py-4 text-sm font-semibold">{item.ingredient_info?.name ?? item.ingredient_id}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.adjustment_type === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{adjustmentTypeLabels[item.adjustment_type]}</span></td><td className="px-5 py-4 text-sm">{formatNumber(item.quantity, 3)} <span className="text-stone-500">{item.ingredient_info?.base_unit_info?.code}</span></td><td className="px-5 py-4 text-sm text-stone-600">{item.reason || "-"}</td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openItemModal(item)} disabled={!canWrite} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"><Pencil size={15} /></button><button type="button" onClick={() => requestDelete(item)} disabled={!canWrite} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>
          </section>
        </main>
      </section>
      {modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><form onSubmit={submitItem} className="w-full max-w-md rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-stone-200 p-5"><h2 className="text-lg font-bold">{editingItem ? "Update item" : "Add item"}</h2><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-stone-700">Ingredient<select value={form.ingredient_id} onChange={(event) => setForm((current) => ({ ...current, ingredient_id: event.target.value }))} required className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42]"><option value="">Select ingredient</option>{ingredients.map((ingredient) => <option key={ingredient.ingredient_id} value={ingredient.ingredient_id}>{ingredient.name}</option>)}</select></label><label className="block text-sm font-semibold text-stone-700">Adjustment Type<select value={form.adjustment_type} onChange={(event) => setForm((current) => ({ ...current, adjustment_type: event.target.value as StockAdjustmentItemPayload["adjustment_type"] }))} required className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42]"><option value="IN">Tambah Stok</option><option value="OUT">Kurangi Stok</option></select></label><label className="block text-sm font-semibold text-stone-700">Quantity ({ingredients.find((ingredient) => ingredient.ingredient_id === form.ingredient_id)?.base_unit_info?.code || "base unit"})<input inputMode="decimal" value={formatNumber(form.quantity, 3)} onChange={(event) => setForm((current) => ({ ...current, quantity: normalizeNumberInput(event.target.value) }))} required className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42]" /></label><label className="block text-sm font-semibold text-stone-700">Reason<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42]" /></label></div><footer className="flex justify-end gap-3 border-t border-stone-200 p-5"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button><button type="submit" disabled={submitting || !canWrite} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button></footer></form></div>}
      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
