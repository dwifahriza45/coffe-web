import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getInventoryCount, saveInventoryCountDraft, submitInventoryCount, type InventoryCount } from "../../api/inventoryCount.api";
import {
  createInventoryCountItem,
  deleteInventoryCountItem,
  getInventoryCountItems,
  updateInventoryCountItem,
  type InventoryCountItem,
  type InventoryCountItemPayload,
} from "../../api/inventoryCountItem.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyItemForm: InventoryCountItemPayload = { inventory_count_id: "", ingredient_id: "", actual_quantity: "", notes: "" };

function countTitle(type?: InventoryCount["count_type"]) {
  return type === "OPENING" ? "Opening Stock" : "Closing Stock";
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("en-GB") : "-";
}

export default function InventoryCountDetailPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const canEditDraft = roles.some((role) => ["admin", "leader", "inventory"].includes(role));
  const canSubmit = roles.some((role) => ["admin", "leader"].includes(role));
  const { businessDayID = "", inventoryCountID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [items, setItems] = useState<InventoryCountItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryCountItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
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
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const [countResponse, itemResponse, ingredientResponse] = await Promise.all([
          getInventoryCount(inventoryCountID),
          getInventoryCountItems({ start: 0, limit: 100, inventory_count_id: inventoryCountID, ingredient_id: "", name: "" }),
          getIngredients({ start: 0, limit: 100, name: "" }),
        ]);
        if (!current) return;
        const nextCount = countResponse.data ?? null;
        setCount(nextCount);
        setNotes(nextCount?.notes ?? "");
        setItems(itemResponse.data ?? []);
        setIngredients(ingredientResponse.data ?? []);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setError(response?.message || "Could not load stock count detail.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      current = false;
    };
  }, [inventoryCountID, refreshKey]);

  function openItemModal(item?: InventoryCountItem) {
    setEditingItem(item ?? null);
    setItemForm(item ? {
      inventory_count_id: item.inventory_count_id,
      ingredient_id: item.ingredient_id,
      actual_quantity: item.actual_quantity,
      notes: item.notes,
    } : { ...emptyItemForm, inventory_count_id: inventoryCountID });
    setModalOpen(true);
  }

  async function saveDraft() {
    setSubmitting(true);
    setError("");
    try {
      await saveInventoryCountDraft(inventoryCountID, { notes });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not save draft.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestSubmit() {
    setConfirm({
      title: `Submit ${countTitle(count?.count_type)}`,
      message: "Submit this stock count?",
      confirmText: "Submit",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await submitInventoryCount(inventoryCountID);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not submit stock count.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    setConfirm({
      title: editingItem ? "Update item" : "Add item",
      message: editingItem ? "Update this stock count item?" : "Add this stock count item?",
      confirmText: editingItem ? "Update item" : "Add item",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          if (editingItem) {
            await updateInventoryCountItem(editingItem.inventory_count_item_id, itemForm);
          } else {
            await createInventoryCountItem(itemForm);
          }
          setModalOpen(false);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not save stock count item.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: InventoryCountItem) {
    setConfirm({
      title: "Delete item",
      message: "Delete this stock count item?",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteInventoryCountItem(item.inventory_count_item_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not delete stock count item.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const locked = count?.status === "SUBMITTED";
  const canMutateDraft = canEditDraft && !locked;
  const backPath = businessDayID ? `/business-days/${businessDayID}/inventory-counts` : "/stock-count";

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={backPath} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={17} />
            Stock Count
          </Link>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold">{countTitle(count?.count_type)}</h1>
                <p className="mt-2 text-sm text-stone-500">{count?.business_day_info?.business_date ?? businessDayID}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={`rounded-full px-2.5 py-1 ${count?.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{count?.status ?? "DRAFT"}</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">Submitted by {count?.counted_by_info?.fullname ?? count?.counted_by ?? "-"}</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">Submitted at {formatDateTime(count?.counted_at)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveDraft()} disabled={!canMutateDraft || submitting} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent">Save Draft</button>
                {canSubmit && <button type="button" onClick={requestSubmit} disabled={locked || submitting} className="rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit</button>}
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold text-stone-700">
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canMutateDraft || submitting} placeholder="Example: counted after morning prep, all dry goods checked." className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10 disabled:bg-stone-100" />
            </label>
          </section>

          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div>
                <h2 className="font-semibold">Stock Count Items</h2>
                <p className="text-xs text-stone-500">{items.length} items</p>
              </div>
              <button type="button" onClick={() => openItemModal()} disabled={!canMutateDraft} className="flex items-center gap-2 rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Plus size={16} />
                Add item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Ingredient</th>
                    <th className="px-5 py-3">Actual Quantity</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">Loading items...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">No items yet</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.inventory_count_item_id}>
                        <td className="px-5 py-4 text-sm font-semibold">{item.ingredient_info?.name ?? item.ingredient_id}</td>
                        <td className="px-5 py-4 text-sm">{item.actual_quantity ? formatNumber(item.actual_quantity, 3) : "-"}</td>
                        <td className="px-5 py-4 text-sm text-stone-600">{item.notes || "-"}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => openItemModal(item)} disabled={!canMutateDraft} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title="Update item"><Pencil size={15} /></button>
                            <button type="button" onClick={() => requestDelete(item)} disabled={!canMutateDraft} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title="Delete item"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitItem} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingItem ? "Update item" : "Add item"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Ingredient
                <select value={itemForm.ingredient_id} onChange={(event) => setItemForm((current) => ({ ...current, ingredient_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting}>
                  <option value="">Select ingredient</option>
                  {ingredients.map((ingredient) => <option key={ingredient.ingredient_id} value={ingredient.ingredient_id}>{ingredient.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Actual quantity
                <input inputMode="decimal" value={formatNumber(itemForm.actual_quantity, 3)} onChange={(event) => setItemForm((current) => ({ ...current, actual_quantity: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Notes
                <textarea value={itemForm.notes} onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Example: 1 bag opened, remaining stock already weighed." className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
