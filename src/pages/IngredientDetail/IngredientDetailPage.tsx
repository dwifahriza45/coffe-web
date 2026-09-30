import { ArrowLeft, ListPlus, Pencil, Power, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getIngredient, type Ingredient } from "../../api/ingredient.api";
import {
  createIngredientUnit,
  deleteIngredientUnit,
  getIngredientUnits,
  updateIngredientUnit,
  type IngredientUnit,
  type IngredientUnitPayload,
} from "../../api/ingredientUnit.api";
import { getUnits, type Unit } from "../../api/unit.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyForm: IngredientUnitPayload = {
  ingredient_id: "",
  unit_id: "",
  conversion_factor: "",
  active: true,
};

function formatFactor(value: string) {
  return formatNumber(value, 6);
}

export default function IngredientDetailPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreateIngredientUnits = userCan(user, "ingredient_units", "create");
  const canReadIngredientUnits = userCan(user, "ingredient_units", "read");
  const canUpdateIngredientUnits = userCan(user, "ingredient_units", "update");
  const canDeleteIngredientUnits = userCan(user, "ingredient_units", "delete");
  const showActions = canUpdateIngredientUnits || canDeleteIngredientUnits;
  const shouldLoadUnits = canCreateIngredientUnits || canUpdateIngredientUnits;
  const { ingredientID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [items, setItems] = useState<IngredientUnit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IngredientUnit | null>(null);
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
    async function loadDetail() {
      setLoading(true);
      setError("");
      setItems([]);
      try {
        const [ingredientResponse, unitResponse, itemResponse] = await Promise.all([
          getIngredient(ingredientID),
          shouldLoadUnits
            ? getUnits({ start: 0, limit: 100, name: "" })
            : Promise.resolve({ data: [] }),
          canReadIngredientUnits
            ? getIngredientUnits({
                start: 0,
                limit: 100,
                ingredient_id: ingredientID,
                unit_id: "",
                name: "",
              })
            : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;
        setIngredient(ingredientResponse.data ?? null);
        setUnits(unitResponse.data ?? []);
        setItems((itemResponse.data ?? []).filter((item) => item.ingredient_id === ingredientID));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setIngredient(null);
        setUnits([]);
        setItems([]);
        setError(response?.message || t("Could not load ingredient detail."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      current = false;
    };
  }, [canReadIngredientUnits, ingredientID, refreshKey, shouldLoadUnits]);

  function openModal(item?: IngredientUnit) {
    setEditingItem(item ?? null);
    setForm(
      item
        ? {
            ingredient_id: item.ingredient_id,
            unit_id: item.unit_id,
            conversion_factor: item.conversion_factor,
            active: item.active,
          }
        : { ...emptyForm, ingredient_id: ingredientID },
    );
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (!form.unit_id || !form.conversion_factor) {
      setFieldErrors({
        unit_id: !form.unit_id ? t("unit is required") : "",
        conversion_factor: !form.conversion_factor ? t("conversion factor is required") : "",
      });
      return;
    }
    setConfirm({
      title: editingItem ? t("Update ingredient unit") : t("Create ingredient unit"),
      message: editingItem ? t("Update this ingredient unit?") : t("Create this ingredient unit?"),
      confirmText: editingItem ? t("Update ingredient unit") : t("Create ingredient unit"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const payload = { ...form, ingredient_id: ingredientID };
      if (editingItem) {
        await updateIngredientUnit(editingItem.ingredient_unit_id, payload);
      } else {
        await createIngredientUnit(payload);
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

  function requestToggleActive(item: IngredientUnit) {
    setConfirm({
      title: item.active ? t("Deactivate ingredient unit") : t("Activate ingredient unit"),
      message: item.active ? t("Deactivate this ingredient unit?") : t("Activate this ingredient unit?"),
      confirmText: item.active ? t("Deactivate") : t("Activate"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await updateIngredientUnit(item.ingredient_unit_id, {
            ingredient_id: item.ingredient_id,
            unit_id: item.unit_id,
            conversion_factor: item.conversion_factor,
            active: !item.active,
          });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not update ingredient unit status."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: IngredientUnit) {
    setConfirm({
      title: t("Delete ingredient unit"),
      message: t("Delete this ingredient unit permanently?"),
      confirmText: t("Delete ingredient unit"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteIngredientUnit(item.ingredient_unit_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not delete ingredient unit."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const columnCount = showActions ? 4 : 3;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to="/ingredient-management" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={16} />
            {t("Ingredient Management")}
          </Link>

          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-3xl font-bold">{ingredient?.name ?? t("Ingredient Detail")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Base unit")}: {ingredient?.base_unit_info?.code ?? ingredient?.base_unit ?? "-"} · {t("Minimum stock")}: {ingredient ? formatNumber(ingredient.minimum_stock, 3) : "-"}
              </p>
            </div>
            {canCreateIngredientUnits && <button type="button" onClick={() => openModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
              <ListPlus size={17} />
              {t("Add unit conversion")}
            </button>}
          </header>

          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div>
                <h2 className="font-semibold">{t("Unit Conversions")}</h2>
                <p className="text-xs text-stone-500">{items.length} {t("conversions")}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Unit")}</th>
                    <th className="px-5 py-3">{t("Conversion")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading unit conversions...")}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">{t("No unit conversions found")}</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.ingredient_unit_id}>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold">{item.unit_info?.name ?? "-"}</p>
                          <p className="text-xs text-stone-500">{item.unit_info?.code ?? item.unit_id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold">{formatFactor(item.conversion_factor)}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {item.active ? t("Active") : t("Inactive")}
                          </span>
                        </td>
                        {showActions && <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {canUpdateIngredientUnits && <button type="button" onClick={() => openModal(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title={t("Update ingredient unit")}><Pencil size={15} /></button>}
                            {canUpdateIngredientUnits && <button type="button" onClick={() => requestToggleActive(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title={item.active ? t("Deactivate ingredient unit") : t("Activate ingredient unit")}><Power size={15} /></button>}
                            {canDeleteIngredientUnits && <button type="button" onClick={() => requestDelete(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50" title={t("Delete ingredient unit")}><Trash2 size={15} /></button>}
                          </div>
                        </td>}
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
          <form onSubmit={submitForm} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingItem ? t("Update unit conversion") : t("Add unit conversion")}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                {t("Unit")}
                <select value={form.unit_id} onChange={(event) => setForm((current) => ({ ...current, unit_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting}>
                  <option value="">{t("Select unit")}</option>
                  {units.map((unit) => (
                    <option key={unit.unit_id} value={unit.unit_id} disabled={!unit.active}>{unit.name} ({unit.code}){unit.active ? "" : ` - ${t("Inactive")}`}</option>
                  ))}
                </select>
                {fieldErrors.unit_id && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.unit_id}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Conversion factor")}
                <input inputMode="decimal" placeholder="1" value={formatFactor(form.conversion_factor)} onChange={(event) => setForm((current) => ({ ...current, conversion_factor: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.conversion_factor && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.conversion_factor}</p>}
              </label>
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
