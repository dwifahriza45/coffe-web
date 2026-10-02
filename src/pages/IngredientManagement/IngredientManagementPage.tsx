import { getAllCategoryIngredients, type CategoryIngredient } from "../../api/categoryIngredient.api";
import { getPackagings, type Packaging } from "../../api/packaging.api";
import { getSuppliers, type Supplier } from "../../api/supplier.api";
import { getAllBrandTypes, type BrandType } from "../../api/brandType.api";
import { Boxes, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import {
  createIngredient,
  deleteIngredient,
  getIngredients,
  updateIngredient,
  type Ingredient,
  type IngredientPayload,
} from "../../api/ingredient.api";
import { getUnits, type Unit } from "../../api/unit.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: IngredientPayload = {
  category_ingredient_id: "",
  name: "",
  brand_type_id: "",
  supplier_id: "",
  packaging_id: "",
  package_qty: "1",
  content_qty: "",
  content_unit_id: "",
  minimum_stock: "",
  active: true,
};

export default function IngredientManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreateIngredients = userCan(user, "ingredients", "create");
  const canUpdateIngredients = userCan(user, "ingredients", "update");
  const canDeleteIngredients = userCan(user, "ingredients", "delete");
  const showActions = canUpdateIngredients || canDeleteIngredients;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categoryIngredients, setCategoryIngredients] = useState<CategoryIngredient[]>([]);
  const [brandTypes, setBrandTypes] = useState<BrandType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [unitOptions, setUnitOptions] = useState<Unit[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngredientPayload>(emptyForm);
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
    async function loadIngredients() {
      setLoading(true);
      setError("");
      try {
        const response = await getIngredients({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextIngredients = response.data ?? [];
        setIngredients(nextIngredients);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setIngredients([]);
        setError(response?.message || t("Could not load ingredients."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadIngredients();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey]);

  useEffect(() => {
    let current = true;
    async function loadOptions() {
      try {
        const [unitResponse, brandResponse, supplierResponse, packagingResponse, categoryResponse] = await Promise.all([
          getUnits({ start: 0, limit: 100, name: "" }),
          getAllBrandTypes(),
          getSuppliers({ start: 0, limit: 100, name: "" }),
          getPackagings({ start: 0, limit: 100, name: "" }),
          getAllCategoryIngredients(),
        ]);
        if (!current) return;
        setUnitOptions(unitResponse.data ?? []);
        setBrandTypes(brandResponse);
        setSuppliers(supplierResponse.data ?? []);
        setPackagings(packagingResponse.data ?? []);
        setCategoryIngredients(categoryResponse);
      } catch {
        if (current) {
          setUnitOptions([]);
          setBrandTypes([]);
          setSuppliers([]);
          setPackagings([]);
          setCategoryIngredients([]);
          setActionError(t("Action failed."));
        }
      }
    }
    void loadOptions();
    return () => {
      current = false;
    };
  }, [modalOpen]);

  function openModal(ingredient?: Ingredient) {
    setEditingIngredient(ingredient ?? null);
    setForm(
      ingredient
        ? {
            category_ingredient_id: ingredient.category_ingredient_id,
            name: ingredient.name,
            brand_type_id: ingredient.brand_type_id,
            supplier_id: ingredient.supplier_id,
            packaging_id: ingredient.packaging_id,
            package_qty: ingredient.package_qty,
            content_qty: ingredient.content_qty,
            content_unit_id: ingredient.content_unit_id,
            minimum_stock: ingredient.minimum_stock,
            active: ingredient.active,
          }
        : emptyForm,
    );
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (
      !form.name.trim() ||
      !form.minimum_stock
    ) {
      setFieldErrors({
        name: !form.name.trim() ? t("name is required") : "",
        minimum_stock: !form.minimum_stock ? t("minimum stock is required") : "",
      });
      return;
    }
    const combinationErrors: Record<string, string> = {};
    for (const key of ["brand_type_id", "supplier_id", "packaging_id", "content_unit_id", "package_qty", "content_qty"] as const) {
      if (!form[key]?.trim()) combinationErrors[key] = t("required");
    }
    const validSelections = {
      brand_type_id: brandTypes.some((item) => item.brand_type_id === form.brand_type_id && item.active && categoryIngredients.some((category) => category.category_ingredient_id === item.category_ingredient_id && category.active)),
      supplier_id: suppliers.some((item) => item.supplier_id === form.supplier_id && item.active),
      packaging_id: packagings.some((item) => item.packaging_id === form.packaging_id && item.active),
      content_unit_id: unitOptions.some((item) => item.unit_id === form.content_unit_id && item.active),
    };
    for (const key of Object.keys(validSelections) as (keyof typeof validSelections)[]) {
      if (!validSelections[key]) combinationErrors[key] = t("required");
    }
    for (const key of ["package_qty", "content_qty"] as const) {
      if (!Number.isFinite(Number(form[key])) || Number(form[key]) <= 0) combinationErrors[key] = t("invalid input");
    }
    if (Object.keys(combinationErrors).length) { setFieldErrors(combinationErrors); return; }
    setConfirm({
      title: editingIngredient ? t("Update ingredient") : t("Create ingredient"),
      message: editingIngredient ? t("Update this ingredient?") : t("Create this ingredient?"),
      confirmText: editingIngredient ? t("Update ingredient") : t("Create ingredient"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const ingredientPayload: IngredientPayload = {
        category_ingredient_id: "",
        name: form.name,
        brand_type_id: form.brand_type_id,
        supplier_id: form.supplier_id,
        packaging_id: form.packaging_id,
        package_qty: form.package_qty,
        content_qty: form.content_qty,
        content_unit_id: form.content_unit_id,

        minimum_stock: form.minimum_stock,
        active: form.active,
      };
      if (editingIngredient) {
        await updateIngredient(editingIngredient.ingredient_id, ingredientPayload);
      } else {
        await createIngredient(ingredientPayload);
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

  function requestDelete(ingredient: Ingredient) {
    setConfirm({
      title: t("Delete ingredient"),
      message: t("Delete this ingredient permanently?"),
      confirmText: t("Delete ingredient"),
      tone: "danger",
      onConfirm: () => deleteConfirmed(ingredient.ingredient_id),
    });
  }

  async function deleteConfirmed(ingredientID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteIngredient(ingredientID);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete ingredient."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(ingredient: Ingredient) {
    setConfirm({
      title: ingredient.active ? t("Deactivate ingredient") : t("Activate ingredient"),
      message: ingredient.active ? t("Deactivate this ingredient?") : t("Activate this ingredient?"),
      confirmText: ingredient.active ? t("Deactivate") : t("Activate"),
      onConfirm: () => toggleActiveConfirmed(ingredient),
    });
  }

  async function toggleActiveConfirmed(ingredient: Ingredient) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateIngredient(ingredient.ingredient_id, {
        category_ingredient_id: ingredient.category_ingredient_id,
            name: ingredient.name,
        brand_type_id: ingredient.brand_type_id,
        supplier_id: ingredient.supplier_id,
        packaging_id: ingredient.packaging_id,
        package_qty: ingredient.package_qty,
        content_qty: ingredient.content_qty,
        content_unit_id: ingredient.content_unit_id,

        minimum_stock: ingredient.minimum_stock,
        active: !ingredient.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not update ingredient status."));
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = showActions ? 10 : 9;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e8efe5] text-[#547144]">
                <Boxes size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("Ingredient Management")}</h1>
              <p className="mt-2 text-sm text-stone-500">{t("Manage stock ingredients and packaging.")}</p>
            </div>
            {canCreateIngredients && <button type="button" onClick={() => openModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
              <Plus size={17} />
              {t("Add ingredient")}
            </button>}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t("All ingredients")}</h2>
                <p className="text-xs text-stone-500">{total} {t("ingredients found")}</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
                className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10"
              >
                <Search size={17} className="text-stone-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t("Search ingredient...")} />
              </form>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-220 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Ingredient")}</th>
                    <th className="px-5 py-3">{t("Ingredient Category")}</th>
                    <th className="px-5 py-3">{t("Brand / Type")}</th>
                    <th className="px-5 py-3">{t("Supplier")}</th>
                    <th className="px-5 py-3">{t("Packaging unit")}</th>
                    <th className="px-5 py-3">{t("Content")}</th>
                    <th className="px-5 py-3">{t("Min stock")}</th>
                    <th className="px-5 py-3">{t("Usage")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading ingredients...")}</td></tr>
                  ) : ingredients.length === 0 ? (
                    <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("No ingredients found")}</td></tr>
                  ) : (
                    ingredients.map((ingredient) => {
                      return (
                      <tr key={ingredient.ingredient_id} className="hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold">{ingredient.name}</p>
                        </td>
                        <td className="px-5 py-4 text-sm">{categoryIngredients.find((item) => item.category_ingredient_id === ingredient.category_ingredient_id)?.name ?? "-"}</td>
                        <td className="px-5 py-4 text-sm">{brandTypes.find((item) => item.brand_type_id === ingredient.brand_type_id)?.name ?? "-"}</td>
                        <td className="px-5 py-4 text-sm">{suppliers.find((item) => item.supplier_id === ingredient.supplier_id)?.name ?? "-"}</td>
                        <td className="px-5 py-4 text-sm">{formatNumber(ingredient.package_qty, 3)} {packagings.find((item) => item.packaging_id === ingredient.packaging_id)?.name ?? "-"}</td>
                        <td className="px-5 py-4 text-sm">{formatNumber(ingredient.content_qty, 3)} {unitOptions.find((item) => item.unit_id === ingredient.content_unit_id)?.code ?? "-"}</td>
                        <td className="px-5 py-4 text-sm">{formatNumber(ingredient.minimum_stock, 3)}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ingredient.in_use ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                            {ingredient.in_use ? t("Used") : t("Unused")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ingredient.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {ingredient.active ? t("Active") : t("Inactive")}
                          </span>
                        </td>
                        {showActions && <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {canUpdateIngredients && <button type="button" onClick={(event) => { event.stopPropagation(); openModal(ingredient); }} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title={t("Update ingredient")}><Pencil size={15} /></button>}
                            {canUpdateIngredients && <button type="button" onClick={(event) => { event.stopPropagation(); requestToggleActive(ingredient); }} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={ingredient.active ? t("Deactivate ingredient") : t("Activate ingredient")}><Power size={15} /></button>}
                            {canDeleteIngredients && <button type="button" onClick={(event) => { event.stopPropagation(); requestDelete(ingredient); }} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={t("Delete ingredient")}><Trash2 size={15} /></button>}
                          </div>
                        </td>}
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">{t("Page")} {page} {t("of")} {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Limit")}
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPage(1);
                      setPageSize(Number(event.target.value));
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Previous")}</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Next")}</button>
              </div>
            </footer>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="max-h-[90vh] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingIngredient ? t("Update ingredient") : t("Add ingredient")}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                {t("Name")}
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.name && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.name}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Minimum stock")}
                <input inputMode="decimal" placeholder="0" value={formatNumber(form.minimum_stock, 3)} onChange={(event) => setForm((current) => ({ ...current, minimum_stock: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.minimum_stock && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.minimum_stock}</p>}
              </label>
              <SelectField label={t("Brand / Type")} value={form.brand_type_id} error={fieldErrors.brand_type_id} onChange={(value) => setForm((current) => ({ ...current, brand_type_id: value }))} options={brandTypes.filter((item) => item.active && categoryIngredients.some((category) => category.category_ingredient_id === item.category_ingredient_id && category.active)).map((item) => ({ value: item.brand_type_id, label: item.name }))} />
              <SelectField label={t("Supplier")} value={form.supplier_id} error={fieldErrors.supplier_id} onChange={(value) => setForm((current) => ({ ...current, supplier_id: value }))} options={suppliers.filter((item) => item.active).map((item) => ({ value: item.supplier_id, label: item.name }))} />
              <SelectField label={t("Packaging unit")} value={form.packaging_id} error={fieldErrors.packaging_id} onChange={(value) => setForm((current) => ({ ...current, packaging_id: value }))} options={packagings.filter((item) => item.active).map((item) => ({ value: item.packaging_id, label: `${item.name} (${item.code})` }))} />
              <InputField label={t("Package Qty")} value={form.package_qty} error={fieldErrors.package_qty} onChange={(value) => setForm((current) => ({ ...current, package_qty: normalizeNumberInput(value) }))} />
              <InputField label={t("Content Qty")} value={form.content_qty} error={fieldErrors.content_qty} onChange={(value) => setForm((current) => ({ ...current, content_qty: normalizeNumberInput(value) }))} />
              <SelectField label={t("Content unit")} value={form.content_unit_id} error={fieldErrors.content_unit_id} onChange={(value) => setForm((current) => ({ ...current, content_unit_id: value }))} options={unitOptions.filter((item) => item.active).map((item) => ({ value: item.unit_id, label: `${item.name} (${item.code})` }))} />
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Cancel")}</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? t("Saving...") : t("Save")}</button>
            </footer>
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

function SelectField({ label, value, error, options, optional, disabled, onChange }: { label: string; value: string; error?: string; optional?: boolean; disabled?: boolean; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}<select value={options.some((option) => option.value === value) ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"><option value="">{optional ? "-" : "Select"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}</label>;
}
