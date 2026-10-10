import { recordClosingWaste } from "../../api/stockMovement.api";
import { copyPreviousStockCountSection, getStockCountSections, submitStockCountSection, saveStockCountSectionDraft, type StockCountSection, type StockCountBalance } from "../../api/inventoryCount.api";
import { stockRecap } from "../../utils/stockRecap";
import { inventorySectionLabel } from "../../utils/stockDisplay";
import StockCountDepartments from "../../components/common/StockCountDepartments";
import { getStockCountDepartment, matchesStockCountDepartment } from "../../utils/stockCountDepartment";
import {
  getAllCategoryIngredients,
  getIngredientSubcategories,
  type CategoryIngredient,
  type IngredientSubcategory,
} from "../../api/categoryIngredient.api";
import { formatBusinessDate } from "../../utils/businessDate";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import {
  getInventoryCount,
  type InventoryCount,
} from "../../api/inventoryCount.api";
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
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import {
  formatNumber,
  formatNumberInput,
  normalizeNumberInput,
  storedNumberInput,
} from "../../utils/numberFormat";

const emptyItemForm: InventoryCountItemPayload = {
  inventory_count_id: "",
  ingredient_id: "",
  actual_quantity: "",
  notes: "",
};

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

function numericValue(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unitCode(ingredient?: Ingredient) {
  return ingredient?.base_unit_info?.code ?? ingredient?.base_unit ?? "";
}

export default function InventoryCountDetailPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { businessDayID = "", inventoryCountID = "" } = useParams();
  const [params] = useSearchParams();
  const department = getStockCountDepartment(params.get("department"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [count, setCount] = useState<InventoryCount | null>(null);
  const permissionKey =
    count?.count_type === "OPENING"
      ? "inventory_opening_counts"
      : "inventory_closing_counts";
  const [sections, setSections] = useState<StockCountSection[]>([]);
  const [balances, setBalances] = useState<StockCountBalance[]>([]);
  const selectedSection = sections.find((section) => section.department === department?.key);
  const editable = Boolean(count && count.status === "DRAFT" && selectedSection?.status === "DRAFT");
  const canCreateItem = editable && userCan(user, permissionKey, "create");
  const canMutateDraft = editable && userCan(user, permissionKey, "update");
  const canDeleteItem = editable && userCan(user, permissionKey, "delete");
  const canSubmit = canMutateDraft;
  const canLoadIngredients = [
    "inventory_opening_counts",
    "inventory_closing_counts",
  ].some((key) => userCan(user, key, "create") || userCan(user, key, "update"));
  const [items, setItems] = useState<InventoryCountItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [itemCategory, setItemCategory] = useState("");
  const [itemSubcategory, setItemSubcategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryIngredient[]>(
    [],
  );
  const [subcategoryOptions, setSubcategoryOptions] = useState<
    IngredientSubcategory[]
  >([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryCountItem | null>(
    null,
  );
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [submitting, setSubmitting] = useState(false);
  const [waste, setWaste] = useState<{ ingredientID: string; name: string; department: string; unit: string; quantity: string; reason: string; requestID: string } | null>(null);
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
        async function allPages<T>(
          load: (
            start: number,
          ) => Promise<{ data?: T[] | null; total?: number }>,
        ) {
          const data: T[] = [];
          for (;;) {
            const response = await load(data.length);
            const next = response.data ?? [];
            data.push(...next);
            if (!next.length || data.length >= (response.total ?? data.length))
              return { data };
          }
        }
        const [countResponse, itemResponse, ingredientResponse, sectionResponse] =
          await Promise.all([
            getInventoryCount(inventoryCountID),
            allPages((start) =>
              getInventoryCountItems({
                start,
                limit: 100,
                inventory_count_id: inventoryCountID,
                ingredient_id: "",
                name: "",
              }),
            ),
            canLoadIngredients
              ? allPages((start) =>
                  getIngredients({ start, limit: 100, name: "" }),
                )
              : Promise.resolve({ data: [] as Ingredient[] }),
            getStockCountSections(inventoryCountID),
          ]);
        if (!current) return;
        const nextCount = countResponse.data ?? null;
        setSections(sectionResponse.data?.sections ?? []);
        setBalances(sectionResponse.data?.balances ?? []);
        setCount(nextCount);
        setNotes(nextCount?.notes ?? "");
        setItems(itemResponse.data ?? []);
        setIngredients(ingredientResponse.data ?? []);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setError(response?.message || t("Could not load stock count detail."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      current = false;
    };
  }, [inventoryCountID, refreshKey, canLoadIngredients]);

  useEffect(() => {
    if (!modalOpen && !department) return;
    let current = true;
    setOptionsLoading(true);
    setOptionsError("");
    Promise.all([getAllCategoryIngredients(), getIngredientSubcategories()])
      .then(([categories, subcategories]) => {
        if (!current) return;
        setCategoryOptions(categories);
        if (department && !editingItem) setItemCategory(categories.find((category) => matchesStockCountDepartment(category.name, department.key))?.category_ingredient_id ?? "");
        setSubcategoryOptions(subcategories.data ?? []);
      })
      .catch(() => {
        if (current)
          setOptionsError(t("Could not load ingredient categories."));
      })
      .finally(() => {
        if (current) setOptionsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [modalOpen, department?.key]);

  useEffect(() => { setNotes(selectedSection?.notes ?? ""); }, [selectedSection?.notes, department?.key]);

  function resetItemSelection() {
    setItemForm((current) => ({
      ...current,
      ingredient_id: "",
      actual_quantity: "",
      gross_weight: "",
      container_weight: "",
      container_count: "",
      grams_per_unit: "",
    }));
  }

  function openItemModal(item?: InventoryCountItem) {
    if (loading || submitting || (item ? !canMutateDraft : !canCreateItem))
      return;
    const selected =
      item?.ingredient_info ??
      ingredients.find(
        (ingredient) => ingredient.ingredient_id === item?.ingredient_id,
      );
    setItemCategory(selected?.category_ingredient_id ?? (department ? categoryOptions.find((category) => matchesStockCountDepartment(category.name, department.key))?.category_ingredient_id : "") ?? "");
    setItemSubcategory(selected?.subcategory_ingredient_id ?? "");
    setEditingItem(item ?? null);
    setItemForm(
      item
        ? {
            inventory_count_id: item.inventory_count_id,
            ingredient_id: item.ingredient_id,
            actual_quantity: storedNumberInput(item.actual_quantity),
            notes: item.notes,
            gross_weight: "",
            container_weight: storedNumberInput(item.container_weight),
            container_count: "",
            grams_per_unit: "",
          }
        : { ...emptyItemForm, inventory_count_id: inventoryCountID },
    );
    setModalOpen(true);
  }

  async function saveDraft() {
    if (!canMutateDraft || submitting || loading) return;
    setSavingDraft(true);
    setNotice("");
    setSubmitting(true);
    setError("");
    try {
      await saveStockCountSectionDraft(inventoryCountID, department!.key, notes);
      setCount((current) => (current ? { ...current, notes } : current));
      setNotice(t("Draft saved successfully."));
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not save draft."));
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  }

  function requestSubmit() {
    if (
      !canSubmit ||
      submitting ||
      loading
    )
      return;
    setNotice("");
    setConfirm({
      title: `${t("Submit")} ${count?.count_type === "OPENING" ? t("Opening Stock") : t("Closing Stock")}`,
      message: `${t("Submit this section only? Other sections can continue counting.")} (${department?.label})`,
      confirmText: t("Submit"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await submitStockCountSection(inventoryCountID, department!.key);
          setNotice(t("Stock count submitted successfully."));
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not submit stock count."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    if (
      loading ||
      submitting ||
      (editingItem ? !canMutateDraft : !canCreateItem)
    )
      return;
    setConfirm({
      title: editingItem ? t("Update item") : t("Add item"),
      message: editingItem
        ? t("Update this stock count item?")
        : t("Add this stock count item?"),
      confirmText: editingItem ? t("Update item") : t("Add item"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          if (editingItem) {
            await updateInventoryCountItem(
              editingItem.inventory_count_item_id,
              itemForm,
            );
          } else {
            await createInventoryCountItem(itemForm);
          }
          setModalOpen(false);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not save stock count item."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: InventoryCountItem) {
    if (!canDeleteItem || loading || submitting) return;
    setConfirm({
      title: t("Delete item"),
      message: t("Delete this stock count item?"),
      confirmText: t("Delete"),
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
          setError(
            response?.message || t("Could not delete stock count item."),
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const locked = count?.status === "SUBMITTED" || selectedSection?.status === "SUBMITTED";
  const visibleItems = department ? items.filter((item) => {
    const ingredient = item.ingredient_info ?? ingredients.find((candidate) => candidate.ingredient_id === item.ingredient_id);
    if (item.department) return item.department === department.key;
    return matchesStockCountDepartment(ingredient?.category_ingredient_name ?? categoryOptions.find((category) => category.category_ingredient_id === ingredient?.category_ingredient_id)?.name ?? "", department.key);
  }) : items;
  const backQuery = new URLSearchParams({
    ...(department ? { department: department.key } : {}),
    ...(count?.business_day_info?.business_date
      ? { date: count.business_day_info.business_date }
      : {}),
    ...(count?.business_day_id ? { businessDayID: count.business_day_id } : {}),
  });
  const backPath = businessDayID
    ? `/business-days/${businessDayID}/inventory-counts?${backQuery}`
    : `/stock-count?${backQuery}`;

  const recapRows = visibleItems.map((item) => {
    const ingredient = item.ingredient_info;
    const balance = balances.find((entry) => entry.item_id === item.inventory_count_item_id);
    const unit = item.stock_unit || unitCode(ingredient);
    const waiters = item.department === "waiters" || inventorySectionLabel(ingredient?.category_ingredient_name ?? "") === "Waiters";
    const physical = item.actual_quantity == null || item.actual_quantity === "" ? null : numericValue(item.actual_quantity);
    const minimum = balance?.minimum == null ? null : numericValue(balance.minimum);
    const target = balance?.target == null ? null : numericValue(balance.target);
    const recap = stockRecap({ closing: count?.count_type === "CLOSING", waiters,
      opening: balance?.opening == null ? null : numericValue(balance.opening),
      incoming: numericValue(balance?.stock_in), outgoing: numericValue(balance?.stock_out), adjustment: numericValue(balance?.adjustment),
      physical, minimum, target, baseUnit: unit, packaging: balance?.packaging ?? "",
      contentUnit: balance?.content_unit ?? "", contentQty: numericValue(balance?.content_qty), packageQty: numericValue(balance?.package_qty ?? undefined),
    });
    return { item, ingredient, balance, unit, waiters, physical, minimum, target, ...recap };
  });
  const quantityLabel = (value: number | null, unit: string) => value === null ? "—" : `${formatNumber(String(value), 3)} ${unit}`;

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link
            to={backPath}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft size={17} />
            {t("Stock Count")}
          </Link>

          <StockCountDepartments statuses={Object.fromEntries(sections.map((section) => [section.department, section.status]))} />
          <p className="mb-4 text-xs text-stone-500">{t("Submit each section separately. Completed sections are locked; other sections can continue.")}</p>
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold">
                  {count?.count_type === "OPENING"
                    ? t("Opening Stock")
                    : t("Closing Stock")}
                  {department ? ` · ${department.label}` : ""}
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                  {formatBusinessDate(count?.business_day_info?.business_date)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-1 ${(selectedSection?.status ?? count?.status) === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {selectedSection?.status ?? count?.status ?? "DRAFT"}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                    {t("Submitted by")}{" "}
                    {selectedSection?.counted_by || count?.counted_by_info?.fullname || "-"}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                    {t("Submitted at")} {formatDateTime(selectedSection?.counted_at || count?.counted_at)}
                  </span>
                </div>
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold text-stone-700">
              {t("Notes")}
              <textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setNotice("");
                }}
                disabled={!canMutateDraft || submitting || loading}
                placeholder={t(
                  "Example: counted after morning prep, all dry goods checked.",
                )}
                className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10 disabled:bg-stone-100"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {userCan(user, permissionKey, "update") && <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!canMutateDraft || submitting || loading}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
              >
                {savingDraft ? t("Saving...") : t("Save Draft")}
              </button>}
              {canCreateItem && canMutateDraft && count?.count_type === "OPENING" && <button type="button" disabled={loading || submitting} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold" onClick={() => setConfirm({title: t("Copy previous closing stock"), message: t("Copy previous submitted closing quantities into this section? Existing items are kept."), confirmText: t("Copy"), onConfirm: async () => {setConfirm(null);setSubmitting(true);try {const result=await copyPreviousStockCountSection(inventoryCountID,department!.key);setNotice(`${t("Items copied")}: ${result.data?.copied ?? 0}`);setRefreshKey((value) => value+1);} catch (requestError) {setError(isAxiosError<{message?: string}>(requestError) ? requestError.response?.data?.message || t("Could not copy stock.") : t("Could not copy stock."));} finally {setSubmitting(false);}}})}>{t("Copy previous closing stock")}</button>}
              {canSubmit && (
                <button
                  type="button"
                  onClick={requestSubmit}
                  disabled={
                    locked ||
                    submitting ||
                    loading
                  }
                  className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t("Submit")} {department?.label}
                </button>
              )}
            </div>
            {notice && (
              <p role="status" className="mt-3 text-sm text-emerald-700">
                {notice}
              </p>
            )}
          </section>

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {t(error)}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-stone-600"><span className="rounded bg-yellow-50 px-3 py-2">{t("Yellow: physical remaining stock entered by staff")}</span><span className="rounded bg-stone-100 px-3 py-2">{t("Gray: system reference, read only")}</span></div>
          <section className="mt-5 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">
              {t("Stock value at count")}{department ? ` · ${department.label}` : ""}
            </p>
            <p className="mt-2 text-2xl font-bold">
              Rp{" "}
              {formatNumber(
                String(
                  visibleItems.reduce(
                    (total, item) => total + Number(item.stock_value || 0),
                    0,
                  ),
                ),
                2,
              )}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              {t("Value uses the unit price saved with each count item.")}
            </p>
            {visibleItems.some(
              (item) => item.actual_quantity !== "" && item.stock_value === "",
            ) && (
              <p className="mt-2 text-xs text-amber-800">
                {t(
                  "Some items have no saved price. Their value is not included in this total.",
                )}
              </p>
            )}
          </section>
          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 p-4">
              <div><h2 className="font-semibold">Rekap SO</h2><p className="mt-1 text-xs text-stone-500">{visibleItems.length} item · {count?.count_type === "OPENING" ? "Stok Awal" : "Stok Akhir"}</p></div>
              {userCan(user, permissionKey, "create") && <button type="button" onClick={() => openItemModal()} disabled={!canCreateItem || loading || submitting} className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />{t("Add item")}</button>}
            </div>
            <p className="px-4 py-3 text-xs leading-relaxed text-stone-500">Barista/Kitchen: pemakaian dari Stock Movement tercatat; selisih membandingkan stok fisik dengan stok sistem. Waiters: pemakaian dihitung dari stok awal + masuk + penyesuaian − stok akhir fisik, termasuk waste jika ada. Hasil negatif perlu diperiksa. Rekap draft masih sementara.</p>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[1750px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-stone-500"><tr>{["Item", "Opening Stock", "Stock In", "Adjustments", "Pemakaian", "Closing Stock", "Variance", "Stock value", "Action"].map((label) => <th key={label} className="px-4 py-3">{t(label)}</th>)}</tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={9} className="p-12 text-center">{t("Loading items...")}</td></tr> : !recapRows.length ? <tr><td colSpan={9} className="p-12 text-center text-stone-500">{t("No items yet")}</td></tr> : recapRows.map((row) => <tr key={row.item.inventory_count_item_id} className="[&>td]:bg-brand-surface hover:[&>td]:bg-brand-soft">
                    <td className="min-w-72 rounded-l-2xl px-4 py-4">
                      <p className="font-semibold text-brand-primary">{row.ingredient?.name ?? row.item.ingredient_id}</p>
                      <p className="mt-1 text-xs text-stone-500">{row.balance?.brand || "—"}</p>
                      <details className="mt-2 text-xs text-stone-500"><summary className="cursor-pointer">Informasi item</summary>
                        <div className="mt-2 space-y-1">
                          <p>Isi: {row.balance?.content_qty ? `${formatNumber(row.balance.content_qty,3)} ${row.balance.content_unit}` : "—"}</p>
                          <p>Berat kemasan kosong: {row.item.container_weight ? `${formatNumber(row.item.container_weight,3)} g` : "—"}</p>
                          <p>Harga satuan: {row.item.valuation_unit_price ? `Rp ${formatNumber(row.item.valuation_unit_price,6)} / ${row.unit}` : "—"}</p>
                          <p>Stok sistem: {quantityLabel(row.expected,row.unit)}</p>
                          <p>Stock Movement keluar tercatat: {formatNumber(row.balance?.stock_out || "0",3)} {row.unit}</p>
                          <p>Catatan: {row.item.notes || "—"}</p>
                        </div>
                      </details>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">{quantityLabel(count?.count_type === "OPENING" ? row.physical : row.balance?.opening == null ? null : numericValue(row.balance.opening),row.unit)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-emerald-700">{count?.count_type === "OPENING" ? "—" : `+${formatNumber(row.balance?.stock_in || "0",3)} ${row.unit}`}</td>
                    <td className="whitespace-nowrap px-4 py-4">{count?.count_type === "OPENING" ? "—" : quantityLabel(numericValue(row.balance?.adjustment),row.unit)}</td>
                    <td className="whitespace-nowrap px-4 py-4"><p className={row.invalid ? "font-semibold text-amber-800" : "font-semibold"}>{row.invalid ? "Perlu diperiksa" : quantityLabel(row.consumption,row.unit)}</p><p className="mt-1 text-xs text-stone-500">{row.waiters ? "Dari hitung fisik" : "Dari Stock Movement tercatat"}</p></td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">{count?.count_type === "CLOSING" ? quantityLabel(row.physical,row.unit) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4"><p className={row.variance ? "font-semibold text-amber-800" : "font-semibold text-emerald-700"}>{quantityLabel(row.variance,row.unit)}</p>{row.waiters && <p className="mt-1 text-xs text-stone-500">Pemakaian dari fisik</p>}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">{row.item.stock_value ? `Rp ${formatNumber(row.item.stock_value,2)}` : "—"}</td>
                    <td className="rounded-r-2xl px-4 py-4"><div className="flex gap-2">
                      {count?.count_type === "CLOSING" && userCan(user, "stock_adjustments", "create") && <button type="button" disabled={!editable || loading || submitting} onClick={() => { setError(""); setWaste({ ingredientID: row.item.ingredient_id, name: row.ingredient?.name || row.item.ingredient_id, department: row.item.department || department?.key || "", unit: row.unit, quantity: row.variance != null && row.variance < 0 ? String(-row.variance) : "", reason: "", requestID: crypto.randomUUID() }); }} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-30">Catat Waste</button>}
                      {userCan(user, permissionKey, "update") && <button type="button" onClick={() => openItemModal(row.item)} disabled={!canMutateDraft || loading || submitting} className="rounded-lg p-2 text-brand-primary disabled:opacity-30" title={t("Update item")}><Pencil size={16} /></button>}
                      {userCan(user, permissionKey, "delete") && <button type="button" onClick={() => requestDelete(row.item)} disabled={!canDeleteItem || loading || submitting} className="rounded-lg p-2 text-red-600 disabled:opacity-30" title={t("Delete item")}><Trash2 size={16} /></button>}
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="border-b border-stone-200 p-4"><h2 className="font-semibold">Kebutuhan belanja</h2><p className="mt-1 text-xs leading-relaxed text-stone-500">Saat stok di bawah minimum, saran pesan memenuhi target dan dibulatkan ke kemasan utuh. Atur target di Inventory. Saran ini belum membuat PO atau mengurangi pesanan yang masih berjalan.</p></div>
            <div className="overflow-x-auto px-3 pb-3"><table className="w-full min-w-[1200px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-stone-500"><tr>{["Item", "Stok fisik", "Minimum", "Target stok", "Setara kemasan", "Status", "Saran pesan"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
              <tbody>{loading ? <tr><td colSpan={7} className="p-12 text-center">{t("Loading items...")}</td></tr> : !recapRows.length ? <tr><td colSpan={7} className="p-12 text-center text-stone-500">{t("No items yet")}</td></tr> : recapRows.map((row) => <tr key={row.item.inventory_count_item_id} className="[&>td]:bg-brand-surface hover:[&>td]:bg-brand-soft">
                <td className="rounded-l-2xl px-4 py-4 font-semibold text-brand-primary">{row.ingredient?.name ?? row.item.ingredient_id}</td>
                <td className="whitespace-nowrap px-4 py-4">{quantityLabel(row.physical,row.unit)}</td>
                <td className="whitespace-nowrap px-4 py-4">{quantityLabel(row.minimum,row.unit)}</td>
                <td className="whitespace-nowrap px-4 py-4">{row.target && row.target > 0 ? quantityLabel(row.target,row.unit) : "Belum diatur"}</td>
                <td className="whitespace-nowrap px-4 py-4">{row.equivalents === null ? "—" : `${formatNumber(String(row.equivalents),2)} ${row.balance?.packaging || "kemasan"}`}</td>
                <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${row.invalid || row.needsOrder === null ? "bg-stone-100 text-stone-600" : row.needsOrder ? "bg-yellow-200 text-yellow-900" : "bg-brand-sage text-brand-primary"}`}>{row.invalid ? "PERLU DIPERIKSA" : row.needsOrder === null ? "BELUM LENGKAP" : row.needsOrder ? "PERLU ORDER" : "AMAN"}</span>{row.item.section_status !== "SUBMITTED" && <p className="mt-1 text-xs text-stone-500">Sementara · draft</p>}</td>
                <td className="rounded-r-2xl px-4 py-4 font-semibold">{row.suggestion === null ? "—" : `${row.suggestion} ${row.balance?.packaging || "kemasan"}`}{row.suggestion === null && row.needsOrder && !row.invalid && <p className="mt-1 text-xs font-normal text-stone-500">Lengkapi target / isi kemasan</p>}</td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitItem}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">
                {editingItem ? t("Update item") : t("Add item")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {optionsError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {optionsError}
                </p>
              )}
              <label className="block text-sm font-semibold text-stone-700">
                {t("Ingredient Category")}
                <select
                  required
                  value={itemCategory}
                  disabled={submitting || optionsLoading || Boolean(department)}
                  onChange={(event) => {
                    setItemCategory(event.target.value);
                    setItemSubcategory("");
                    resetItemSelection();
                  }}
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] disabled:bg-stone-100"
                >
                  <option value="">
                    {t(
                      optionsLoading
                        ? "Loading..."
                        : "Select ingredient category",
                    )}
                  </option>
                  {categoryOptions.filter((category) => !department || matchesStockCountDepartment(category.name, department.key)).map((category) => (
                    <option
                      key={category.category_ingredient_id}
                      value={category.category_ingredient_id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Ingredient subcategory")}{" "}
                <span className="font-normal text-stone-400">
                  ({t("Optional")})
                </span>
                <select
                  value={itemSubcategory}
                  disabled={submitting || optionsLoading || !itemCategory}
                  onChange={(event) => {
                    setItemSubcategory(event.target.value);
                    resetItemSelection();
                  }}
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] disabled:bg-stone-100"
                >
                  <option value="">{t("All subcategories")}</option>
                  {subcategoryOptions
                    .filter(
                      (sub) => sub.category_ingredient_id === itemCategory,
                    )
                    .map((sub) => (
                      <option
                        key={sub.subcategory_ingredient_id}
                        value={sub.subcategory_ingredient_id}
                      >
                        {sub.name}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs font-normal text-stone-500">
                  {t(
                    "Leave subcategory empty to show all ingredients in this category.",
                  )}
                </p>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Ingredient")}
                <select
                  required
                  value={itemForm.ingredient_id}
                  onChange={(event) => {
                    setItemForm((current) => ({
                      ...current,
                      ingredient_id: event.target.value,
                      gross_weight: "",
                      container_weight: "",
                      container_count: "",
                      grams_per_unit: "",
                    }));
                  }}
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"
                  disabled={submitting || optionsLoading || !itemCategory}
                >
                  <option value="">{t("Select ingredient")}</option>
                  {ingredients
                    .filter(
                      (ingredient) =>
                        ingredient.category_ingredient_id === itemCategory &&
                        (!itemSubcategory ||
                          ingredient.subcategory_ingredient_id ===
                            itemSubcategory),
                    )
                    .map((ingredient) => (
                      <option
                        key={ingredient.ingredient_id}
                        value={ingredient.ingredient_id}
                      >
                        {ingredient.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Stock remaining")} (
                {unitCode(
                  ingredients.find(
                    (item) => item.ingredient_id === itemForm.ingredient_id,
                  ) ?? editingItem?.ingredient_info,
                ) || "—"}
                )
                <input
                  required
                  inputMode="decimal"
                  disabled={submitting}
                  value={formatNumberInput(itemForm.actual_quantity)}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      actual_quantity: normalizeNumberInput(event.target.value),
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)]"
                />
                <p className="mt-1 text-xs font-normal text-stone-500">
                  {t(
                    "Enter the remaining stock directly, as in the Stock Remaining column in Excel.",
                  )}
                </p>
              </label>
              {itemForm.ingredient_id && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-3 text-xs font-semibold text-stone-500">
                    {t("Ingredient reference information")}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-stone-500">
                        {t("Content quantity")}
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {formatNumber(
                          (
                            ingredients.find(
                              (item) =>
                                item.ingredient_id === itemForm.ingredient_id,
                            ) ?? editingItem?.ingredient_info
                          )?.content_qty || "",
                          3,
                        ) || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">
                        {t("Content unit")}
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {unitCode(
                          ingredients.find(
                            (item) =>
                              item.ingredient_id === itemForm.ingredient_id,
                          ) ?? editingItem?.ingredient_info,
                        ) || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              <label className="block text-sm font-semibold text-stone-700">
                {t("Empty container weight (g)")}{" "}
                <span className="font-normal text-stone-400">
                  ({t("Optional")})
                </span>
                <input
                  inputMode="decimal"
                  disabled={submitting}
                  value={formatNumberInput(itemForm.container_weight || "")}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      container_weight: normalizeNumberInput(
                        event.target.value,
                      ),
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)]"
                />
                <p className="mt-1 text-xs font-normal text-stone-500">
                  {t(
                    "Reference only. This weight does not change the stock remaining.",
                  )}
                </p>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Notes")}
                <textarea
                  value={itemForm.notes}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder={t(
                    "Example: 1 bag opened, remaining stock already weighed.",
                  )}
                  className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"
                  disabled={submitting}
                />
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                disabled={
                  submitting || (editingItem ? !canMutateDraft : !canCreateItem)
                }
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t("Saving...") : t("Save")}
              </button>
            </footer>
          </form>
        </div>
      )}

      {waste && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"><form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onSubmit={async (event) => {
 event.preventDefault(); if (submitting) return;
 setSubmitting(true); setError("");
 try { await recordClosingWaste({ inventory_count_id: inventoryCountID, ingredient_id: waste.ingredientID, department: waste.department, quantity: waste.quantity, reason: waste.reason, request_id: waste.requestID }); setWaste(null); setNotice("Waste tercatat di Stock Movement. Pemakaian dan selisih sudah diperbarui."); setRefreshKey((value) => value+1); }
 catch (err) { setError(isAxiosError<{message?:string}>(err) ? err.response?.data?.message || "Gagal mencatat Waste" : "Gagal mencatat Waste"); }
 finally { setSubmitting(false); }
 }}>
 <h2 className="text-lg font-bold">Catat Waste · {waste.name}</h2>
 <p className="mt-2 text-sm text-stone-500">{getStockCountDepartment(waste.department)?.label} · {count?.business_day_info?.business_date}. Catat hanya jumlah yang memang terbuang. Data langsung disubmit dan tidak dapat diedit.</p>
 <label className="mt-4 block text-sm font-semibold">Jumlah terbuang ({waste.unit})<input required inputMode="decimal" value={formatNumberInput(waste.quantity)} onChange={(e) => setWaste({ ...waste, quantity: normalizeNumberInput(e.target.value) })} className="mt-2 block w-full rounded-lg border p-3" /></label>
 <label className="mt-4 block text-sm font-semibold">Alasan Waste<textarea required maxLength={1000} value={waste.reason} onChange={(e) => setWaste({ ...waste, reason: e.target.value })} placeholder="Contoh: tumpah, rusak, atau kedaluwarsa" className="mt-2 block w-full rounded-lg border p-3" /></label>
 {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
 <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setWaste(null)} className="rounded-lg border px-4 py-2">Batal</button><button disabled={submitting || !waste.reason.trim() || !(Number(waste.quantity)>0)} className="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-40">{submitting ? "Menyimpan…" : "Submit Waste"}</button></div>
 </form></div>}
 <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText ?? t("Confirm")}
        tone={confirm?.tone}
        submitting={submitting}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirm?.onConfirm()}
      />
    </div>
  );
}
