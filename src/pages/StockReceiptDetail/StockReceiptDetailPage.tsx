import { isAxiosError } from "axios";
import { ArrowLeft, PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getStockReceipt, type StockReceipt } from "../../api/stockReceipt.api";
import {
  createStockReceiptItem,
  deleteStockReceiptItem,
  getStockReceiptItems,
  updateStockReceiptItem,
  type StockReceiptItem,
  type StockReceiptItemPayload,
} from "../../api/stockReceiptItem.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyForm: StockReceiptItemPayload = { stock_receipt_id: "", ingredient_id: "", quantity: "", notes: "" };

function formatDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

export default function StockReceiptDetailPage() {
  const { stockReceiptID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [receipt, setReceipt] = useState<StockReceipt | null>(null);
  const [items, setItems] = useState<StockReceiptItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockReceiptItem | null>(null);
  const [form, setForm] = useState<StockReceiptItemPayload>(emptyForm);
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
        const [receiptResponse, itemResponse, ingredientResponse] = await Promise.all([
          getStockReceipt(stockReceiptID),
          getStockReceiptItems({ start: 0, limit: 100, stock_receipt_id: stockReceiptID, ingredient_id: "", name: "" }),
          getIngredients({ start: 0, limit: 100, name: "" }),
        ]);
        if (!current) return;
        setReceipt(receiptResponse.data ?? null);
        setItems(itemResponse.data ?? []);
        setIngredients((ingredientResponse.data ?? []).filter((ingredient) => ingredient.active));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
        setError(response?.message || "Could not load stock receipt.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      current = false;
    };
  }, [stockReceiptID, refreshKey]);

  function openItemModal(item?: StockReceiptItem) {
    setEditingItem(item ?? null);
    setForm(item ? {
      stock_receipt_id: item.stock_receipt_id,
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
      notes: item.notes,
    } : { ...emptyForm, stock_receipt_id: stockReceiptID });
    setModalOpen(true);
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!form.ingredient_id || !form.quantity) return;
    setConfirm({
      title: editingItem ? "Update item" : "Add item",
      message: editingItem ? "Update this received item?" : "Add this item to stock in?",
      confirmText: editingItem ? "Update" : "Add item",
      onConfirm: submitItemConfirmed,
    });
  }

  async function submitItemConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) await updateStockReceiptItem(editingItem.stock_receipt_item_id, form);
      else await createStockReceiptItem(form);
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data : undefined;
      setError(response?.message || "Could not save stock receipt item.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(item: StockReceiptItem) {
    setConfirm({
      title: "Delete item",
      message: "Delete this received item?",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteStockReceiptItem(item.stock_receipt_item_id);
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

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to="/stock-in" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={17} />
            Stock In
          </Link>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#efe9df] text-[#8a5a3f]">
                  <PackagePlus size={22} />
                </div>
                <h1 className="font-serif text-3xl font-bold">Stock In</h1>
                <p className="mt-2 text-sm text-stone-500">{receipt?.stock_receipt_id ?? stockReceiptID}</p>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-[100px_minmax(0,1fr)]">
                  <span className="text-stone-500">Date</span>
                  <span className="font-medium">{formatDate(receipt?.receipt_date)}</span>
                  <span className="text-stone-500">Supplier</span>
                  <span className="font-medium">{receipt?.supplier_name || "-"}</span>
                  <span className="text-stone-500">Notes</span>
                  <span className="font-medium">{receipt?.notes || "-"}</span>
                </div>
              </div>
            </div>
          </section>

          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div>
                <h2 className="font-semibold">Stock Receipt Items</h2>
                <p className="text-xs text-stone-500">{items.length} items</p>
              </div>
              <button type="button" onClick={() => openItemModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white">
                <Plus size={16} />
                Add item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Ingredient</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">Loading items...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">No items yet</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.stock_receipt_item_id}>
                      <td className="px-5 py-4 text-sm font-semibold">{item.ingredient_info?.name ?? item.ingredient_id}</td>
                      <td className="px-5 py-4 text-sm">{formatNumber(item.quantity, 3)}</td>
                      <td className="px-5 py-4 text-sm text-stone-600">{item.notes || "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => openItemModal(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Pencil size={15} /></button>
                          <button type="button" onClick={() => requestDelete(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                <select value={form.ingredient_id} onChange={(event) => setForm((current) => ({ ...current, ingredient_id: event.target.value }))} required className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10">
                  <option value="">Select ingredient</option>
                  {ingredients.map((ingredient) => <option key={ingredient.ingredient_id} value={ingredient.ingredient_id}>{ingredient.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Quantity
                <input inputMode="decimal" value={formatNumber(form.quantity, 3)} onChange={(event) => setForm((current) => ({ ...current, quantity: normalizeNumberInput(event.target.value) }))} required className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Notes
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Example: received sealed and checked." className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />
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
