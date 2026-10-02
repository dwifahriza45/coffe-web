import { isAxiosError } from "axios";
import { Pencil, Plus, Scale, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import {
  createIngredientPrice,
  deleteIngredientPrice,
  getIngredientPrices,
  updateIngredientPrice,
  type IngredientPrice,
  type IngredientPricePayload,
} from "../../api/ingredientPrice.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import IngredientDetailDialog from "../../components/common/IngredientDetailDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const today = new Date().toISOString().slice(0, 10);
const emptyForm: IngredientPricePayload = {
  ingredient_id: "",
  price: "",
  effective_date: today,
  active: true,
};

export default function IngredientPriceManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreate = userCan(user, "ingredient_prices", "create");
  const canUpdate = userCan(user, "ingredient_prices", "update");
  const canDelete = userCan(user, "ingredient_prices", "delete");
  const showActions = canUpdate || canDelete;
  const [detailPriceID, setDetailPriceID] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<IngredientPrice[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IngredientPrice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
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
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [priceRes, ingredientRes] =
          await Promise.all([
            getIngredientPrices({ start: (page - 1) * pageSize, limit: pageSize, name: search }),
            getIngredients({ start: 0, limit: 100, name: "" }),
          ]);
        if (!current) return;
        setItems(priceRes.data ?? []);
        setTotal(priceRes.total ?? 0);
        setIngredients(ingredientRes.data ?? []);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setError(response?.message || t("Could not load ingredient prices."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadData();
    return () => {
      current = false;
    };
  }, [page, pageSize, refreshKey, search]);

  function openModal(item?: IngredientPrice) {
    setEditingItem(item ?? null);
    setForm(
      item
        ? {
            ingredient_id: item.ingredient_id,
            price: item.price,
            effective_date: item.effective_date.slice(0, 10),
            active: item.active,
          }
        : emptyForm,
    );
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    const required: (keyof IngredientPricePayload)[] = [
      "ingredient_id",
      "price",
      "effective_date",
    ];
    const errors = required.reduce<Record<string, string>>((result, key) => {
      if (!String(form[key]).trim()) result[key] = t("required");
      return result;
    }, {});
    setFieldErrors(errors);
    setActionError("");
    if (Object.keys(errors).length > 0) return;
    setConfirm({
      title: editingItem ? t("Update ingredient price") : t("Create ingredient price"),
      message: editingItem ? t("Update this ingredient price?") : t("Create this ingredient price?"),
      confirmText: editingItem ? t("Update ingredient price") : t("Create ingredient price"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateIngredientPrice(editingItem.price_id, form);
      } else {
        await createIngredientPrice(form);
      }
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string; valid?: Record<string, string> }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(item: IngredientPrice) {
    setConfirm({
      title: t("Delete ingredient price"),
      message: t("Delete this ingredient price permanently?"),
      confirmText: t("Delete ingredient price"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteIngredientPrice(item.price_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not delete ingredient price."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = showActions ? 6 : 5;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e8efe5] text-[#547144]">
                <Scale size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("Master Price & PAR")}</h1>
              <p className="mt-2 text-sm text-stone-500">{t("Manage supplier prices, packaging content, and effective dates.")}</p>
            </div>
            {canCreate && <button type="button" onClick={() => openModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"><Plus size={17} />{t("Add ingredient price")}</button>}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold">{t("All ingredient prices")}</h2><p className="text-xs text-stone-500">{total} {t("prices found")}</p></div>
              <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                <Search size={17} className="text-stone-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t("Search price...")} />
              </form>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-220 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Ingredient")}</th><th className="px-5 py-3">{t("Price")}</th><th className="px-5 py-3">{t("Unit Price")}</th><th className="px-5 py-3">{t("Effective Date")}</th><th className="px-5 py-3">{t("Status")}</th>{showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading prices...")}</td></tr> : items.length === 0 ? <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("No prices found")}</td></tr> : items.map((item) => (
                    <tr key={item.price_id}>
                      <td className="px-5 py-4 text-sm font-semibold"><button type="button" onClick={() => setDetailPriceID(item.price_id)} className="text-left text-[#9a5735] underline decoration-[#9a5735]/30 underline-offset-4 hover:text-[#362219] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b86b42]" aria-haspopup="dialog">{item.ingredient_info?.name ?? item.ingredient_id}</button></td>
                      <td className="px-5 py-4 text-sm font-semibold">Rp {formatNumber(item.price, 2)}</td>
                      <td className="px-5 py-4 text-sm">Rp {formatNumber(item.unit_price, 2)}</td>
                      <td className="px-5 py-4 text-sm">{item.effective_date}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>{item.active ? t("Active") : t("Inactive")}</span></td>
                      {showActions && <td className="px-5 py-4"><div className="flex justify-end gap-1.5">{canUpdate && <button type="button" onClick={() => openModal(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"><Pencil size={15} /></button>}{canDelete && <button type="button" onClick={() => requestDelete(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><p className="text-xs text-stone-500">{t("Page")} {page} {t("of")} {totalPages}</p><label className="flex items-center gap-2 text-xs font-semibold text-stone-500">{t("Limit")}<select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10">{PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
              <div className="flex gap-2"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Previous")}</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Next")}</button></div>
            </footer>
          </section>
        </main>
      </section>

      {detailPriceID && <IngredientDetailDialog priceID={detailPriceID} onClose={() => setDetailPriceID(null)} />}

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5"><h2 className="text-lg font-bold">{editingItem ? t("Update ingredient price") : t("Add ingredient price")}</h2><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button></header>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <SelectField label={t("Ingredient")} value={form.ingredient_id} error={fieldErrors.ingredient_id} onChange={(value) => setForm((current) => ({ ...current, ingredient_id: value }))} options={ingredients.map((item) => ({ value: item.ingredient_id, label: item.name, disabled: !item.active }))} />
              <InputField label={t("Price")} value={form.price} error={fieldErrors.price} onChange={(value) => setForm((current) => ({ ...current, price: normalizeNumberInput(value) }))} />
              <label className="block text-sm font-semibold text-stone-700">{t("Effective Date")}<input type="date" value={form.effective_date} onChange={(event) => setForm((current) => ({ ...current, effective_date: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />{fieldErrors.effective_date && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.effective_date}</p>}</label>
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Cancel")}</button><button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? t("Saving...") : t("Save")}</button></footer>
          </form>
        </div>
      )}
      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? t("Confirm")} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}

function InputField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}<input inputMode="decimal" value={formatNumber(value, 3)} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" />{error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}</label>;
}

function SelectField({ label, value, error, options, optional, onChange }: { label: string; value: string; error?: string; optional?: boolean; options: { value: string; label: string; disabled?: boolean }[]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"><option value="">{optional ? "-" : "Select"}</option>{options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>{error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}</label>;
}
