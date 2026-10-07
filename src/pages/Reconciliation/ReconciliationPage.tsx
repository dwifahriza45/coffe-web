import { AlertTriangle, Bean, Package, LayoutGrid, List, CheckCircle2, RefreshCw, Scale, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { reconciliationResult } from "../../utils/reconciliation";
import { StockStatusCharts } from "../../components/common/CurrentStockCharts";
import InventoryCategoryFilters from "../../components/common/InventoryCategoryFilters";
import { getAllCategoryIngredients, getIngredientSubcategories, type CategoryIngredient, type IngredientSubcategory } from "../../api/categoryIngredient.api";
import { getBusinessDays } from "../../api/businessDay.api";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { getInventoryCountItems } from "../../api/inventoryCountItem.api";
import { getStockMovements } from "../../api/stockMovement.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate, formatBusinessDate } from "../../utils/businessDate";
import { inventorySectionLabel } from "../../utils/stockDisplay";
import { formatNumber } from "../../utils/numberFormat";

type ReconciliationRow = {
  ingredient: Ingredient;
  opening: number | null;
  stockIn: number;
  usage: number | null;
  adjustment: number;
  expected: number | null;
  resultStatus: "PENDING" | "MATCHED" | "VARIANCE" | "RECORDED" | "CHECK";
  physical: number | null;
  variance: number | null;
};

async function allPages<T>(fetch: (start: number) => Promise<{ data?: T[] | null; total?: number }>) {
  const data: T[] = [];
  for (let start = 0; ;) {
    const response = await fetch(start);
    const page = response.data ?? [];
    data.push(...page);
    start += page.length;
    if (!page.length || start >= (response.total ?? start)) return { data };
  }
}

function toNumber(value?: string) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: number | null, unit?: string) {
  if (value === null) return "—";
  return `${formatNumber(String(value), 3)}${unit ? ` ${unit}` : ""}`;
}

function movementSign(type: string) {
  return ["ORDER_USAGE", "WASTE", "ADJUSTMENT_OUT"].includes(type) ? -1 : 1;
}

function isStockIn(type: string) {
  return type === "STOCK_IN";
}

function isStockOut(type: string) {
  return type === "ORDER_USAGE" || type === "WASTE";
}

function isAdjustment(type: string) {
  return type === "ADJUSTMENT_IN" || type === "ADJUSTMENT_OUT";
}

export default function ReconciliationPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<"list" | "grid">(() => {
    try { return localStorage.getItem("coffee-reconciliation-view") === "grid" ? "grid" : "list"; } catch { return "list"; }
  });
  function changeView(mode: "list" | "grid") {
    setView(mode);
    try { localStorage.setItem("coffee-reconciliation-view", mode); } catch { /* Keep selection for this session. */ }
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [date, setDate] = useState(searchParams.get("date") || currentBusinessDate());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [businessDayID, setBusinessDayID] = useState("");
  const [categories, setCategories] = useState<CategoryIngredient[]>([]);
  const [subcategories, setSubcategories] = useState<IngredientSubcategory[]>([]);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!searchParams.get("date")) setSearchParams({ date }, { replace: true });
  }, [date, searchParams, setSearchParams]);

  useEffect(() => {
    let current = true;
    async function loadReconciliation() {
      setLoading(true);
      setError("");
      try {
        const [dayResponse, categoryResponse, subcategoryResponse] = await Promise.all([
          getBusinessDays({ start: 0, limit: 1, status: "", business_date: date }),
          getAllCategoryIngredients(),
          getIngredientSubcategories(),
        ]);
        if (!current) return;
        setCategories(categoryResponse);
        setSubcategories(subcategoryResponse.data ?? []);
        const day = dayResponse.data?.[0];
        setBusinessDayID(day?.business_day_id ?? "");
        if (!day) {
          setRows([]);
          return;
        }

        const [ingredientResponse, countResponse, movementResponse] = await Promise.all([
          allPages((start) => getIngredients({ start, limit: 100, name: "" })),
          getInventoryCounts({
            start: 0,
            limit: 10,
            business_day_id: day.business_day_id,
            count_type: "",
            status: "",
            name: "",
          }),
          allPages((start) => getStockMovements({
            start,
            limit: 100,
            business_day_id: day.business_day_id,
            business_date: date,
            movement_type: "",
            name: "",
          })),
        ]);
        if (!current) return;

        const counts = countResponse.data ?? [];
        const openingCount = counts.find((count) => count.count_type === "OPENING");
        const closingCount = counts.find((count) => count.count_type === "CLOSING");

        const [openingItems, closingItems] = await Promise.all([
          openingCount
            ? allPages((start) => getInventoryCountItems({
              start,
              limit: 100,
              inventory_count_id: openingCount.inventory_count_id,
              ingredient_id: "",
              name: "",
            }))
            : Promise.resolve({ data: [] }),
          closingCount
            ? allPages((start) => getInventoryCountItems({
              start,
              limit: 100,
              inventory_count_id: closingCount.inventory_count_id,
              ingredient_id: "",
              name: "",
            }))
            : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;

        const openingByIngredient = new Map<string, number>();
        const physicalByIngredient = new Map<string, number>();
        (openingItems.data ?? []).filter((item) => item.section_status === "SUBMITTED").forEach((item) => {
          openingByIngredient.set(item.ingredient_id, toNumber(item.actual_quantity));
        });
        (closingItems.data ?? []).filter((item) => item.section_status === "SUBMITTED" && item.actual_quantity != null).forEach((item) => {
          physicalByIngredient.set(item.ingredient_id, toNumber(item.actual_quantity));
        });

        const movementTotals = new Map<string, { stockIn: number; stockOut: number; adjustment: number }>();
        (movementResponse.data ?? []).forEach((movement) => {
          const totals = movementTotals.get(movement.ingredient_id) ?? { stockIn: 0, stockOut: 0, adjustment: 0 };
          const quantity = toNumber(movement.quantity);
          if (isStockIn(movement.movement_type)) totals.stockIn += quantity;
          if (isStockOut(movement.movement_type)) totals.stockOut += quantity;
          if (isAdjustment(movement.movement_type)) totals.adjustment += movementSign(movement.movement_type) * quantity;
          movementTotals.set(movement.ingredient_id, totals);
        });

        setRows((ingredientResponse.data ?? []).filter((ingredient) => ingredient.active).map((ingredient) => {
          const movement = movementTotals.get(ingredient.ingredient_id) ?? { stockIn: 0, stockOut: 0, adjustment: 0 };
          const opening = openingByIngredient.get(ingredient.ingredient_id) ?? null;
          const physical = physicalByIngredient.has(ingredient.ingredient_id)
            ? physicalByIngredient.get(ingredient.ingredient_id) ?? 0
            : null;
          const result = reconciliationResult({ waiters: inventorySectionLabel(ingredient.category_ingredient_name) === "Waiters", opening, incoming: movement.stockIn, outgoing: movement.stockOut, adjustment: movement.adjustment, physical });
          return {
            ingredient,
            opening,
            stockIn: movement.stockIn,
            usage: result.usage,
            adjustment: movement.adjustment,
            expected: result.expected,
            resultStatus: result.status,
            physical,
            variance: result.variance,
          };
        }));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setRows([]);
        setError(response?.message || t("Could not load reconciliation."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadReconciliation();
    return () => {
      current = false;
    };
  }, [date, refresh, t]);

  const searchedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => !keyword || `${row.ingredient.name} ${row.ingredient.ingredient_id}`.toLowerCase().includes(keyword));
  }, [rows, search]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    searchedRows.forEach(({ ingredient }) => {
      if (ingredient.category_ingredient_id) counts[ingredient.category_ingredient_id] = (counts[ingredient.category_ingredient_id] ?? 0) + 1;
    });
    return counts;
  }, [searchedRows]);
  const visibleRows = useMemo(() => searchedRows.filter(({ ingredient }) =>
    (!category || ingredient.category_ingredient_id === category) &&
    (!subcategory || ingredient.subcategory_ingredient_id === subcategory)
  ), [searchedRows, category, subcategory]);
  const varianceRows = visibleRows.filter((row) => row.resultStatus === "VARIANCE" || row.resultStatus === "CHECK");
  const pendingRows = visibleRows.filter((row) => row.resultStatus === "PENDING");
  const reviewed = visibleRows.length > 0 && pendingRows.length === 0;

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]">
                <Scale size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("Reconciliation")}</h1>
              <p className="mt-2 text-sm text-stone-500">{t("Compare system expected closing with physical closing stock.")}</p>
            </div>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              <RefreshCw size={16} />
              {t("Refresh")}
            </button>
          </header>

          <InventoryCategoryFilters categories={categories} subcategories={subcategories} category={category} subcategory={subcategory} counts={categoryCounts} total={loading ? null : searchedRows.length} onCategory={(id) => { setCategory(id); setSubcategory(""); }} onSubcategory={setSubcategory} />

          <section className="mt-7 rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Business Day")}</p>
                <p className="mt-1 text-lg font-bold">{formatBusinessDate(date)}</p>
                {businessDayID && <p className="mt-1 text-xs text-stone-500">{businessDayID}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label={t("Business Date")}
                  type="date"
                  value={date}
                  onChange={(event) => {
                    const nextDate = event.target.value || currentBusinessDate();
                    setDate(nextDate);
                    setSearchParams({ date: nextDate });
                  }}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput.trim());
                  }}
                  className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2"
                >
                  <Search size={16} className="text-stone-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t("Search ingredient...")}
                    className="min-w-0 bg-transparent text-sm outline-none"
                  />
                </form>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Reviewed Items")}</p>
                <p className="mt-2 text-2xl font-bold">{loading || !businessDayID ? "—" : `${visibleRows.length - pendingRows.length}/${visibleRows.length}`}</p>
              </div>
              <div className={`rounded-lg px-4 py-3 ${loading || !businessDayID ? "bg-stone-50 text-stone-700" : varianceRows.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">Item perlu diperiksa</p>
                <p className="mt-2 text-2xl font-bold">{loading || !businessDayID ? "—" : varianceRows.length}</p>
              </div>
              <div className={`rounded-lg px-4 py-3 ${reviewed ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-700"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">{t("Reconciliation Status")}</p>
                <p className="mt-2 text-2xl font-bold">{loading || !businessDayID ? "—" : reviewed ? t("Ready to Review") : t("Waiting for Closing Stock")}</p>
              </div>
            </div>
          </section>

          <StockStatusCharts loading={loading} rows={businessDayID ? visibleRows.map((row) => ({ section: inventorySectionLabel(row.ingredient.category_ingredient_name), low: row.resultStatus === "VARIANCE" || row.resultStatus === "CHECK", out: row.resultStatus === "PENDING" })) : []} text={{
            labels: ["Sesuai / tercatat", "Perlu diperiksa", "Belum lengkap"], title: "Hasil rekonsiliasi", description: "Status pemeriksaan item pada tanggal dan filter pilihan.",
            priorityTitle: "Pemeriksaan per bagian", priorityDescription: "Item berselisih, tidak wajar, atau belum lengkap.", priorityLabel: "perlu perhatian", centerLabel: "% sesuai / tercatat",
            footer: "Waiters: pemakaian dari hitung fisik, bukan selisih. Sisa yang melebihi stok tersedia perlu diperiksa. Barista/Kitchen: perbandingan stok sistem dan fisik.",
            empty: businessDayID ? "Belum ada item untuk filter ini." : "Belum ada hari operasional pada tanggal ini.",
          }} />

          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex justify-end border-b border-stone-200 p-4">
            <div className="inline-flex rounded-full bg-brand-soft p-1" role="group" aria-label={t("View mode")}>
              {(["list", "grid"] as const).map((mode) => {
                const Icon = mode === "list" ? List : LayoutGrid;
                return <button key={mode} type="button" aria-pressed={view === mode} onClick={() => changeView(mode)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${view === mode ? "bg-brand-primary text-brand-cream" : "text-brand-primary hover:bg-brand-sage"}`}><Icon size={14} />{t(mode === "list" ? "List" : "Grid")}</button>;
              })}
            </div>
          </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {view === "list" ? <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[1560px] table-fixed border-separate border-spacing-y-2 text-left text-sm">
                <colgroup><col style={{ width: "22%" }} />{Array.from({ length: 7 }, (_, index) => <col key={index} style={{ width: "9%" }} />)}<col style={{ width: "15%" }} /></colgroup>
                <thead className="text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    {["Item", "Opening Stock", "Stock In", "Pemakaian", "Adjustments", "Expected Closing", "Physical Closing", "Variance", "Status"].map((label) => (
                      <th key={label} className="px-4 py-3 font-medium">{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-5 py-14 text-center text-stone-500">{t("Loading reconciliation...")}</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-14 text-center text-stone-500">{t("No reconciliation data found")}</td></tr>
                  ) : visibleRows.map((row) => {
                    const unit = row.ingredient.base_unit_info?.code ?? row.ingredient.base_unit ?? "";
                    const section = inventorySectionLabel(row.ingredient.category_ingredient_name);
                    const sub = subcategories.find((item) => item.subcategory_ingredient_id === row.ingredient.subcategory_ingredient_id)?.name;
                    const Icon = section === "Barista" ? Bean : Package;
                    const hasVariance = row.resultStatus === "VARIANCE" || row.resultStatus === "CHECK";
                    const statusText = row.resultStatus === "RECORDED" ? "Pemakaian tercatat" : row.resultStatus === "CHECK" ? "Perlu diperiksa" : row.resultStatus === "PENDING" ? t("Waiting") : hasVariance ? t("Variance") : t("Matched");
                    return (
                      <tr key={row.ingredient.ingredient_id} className="group [&>td]:bg-brand-surface [&>td]:transition-colors hover:[&>td]:bg-brand-soft">
                        <td className="rounded-l-2xl px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-cream text-brand-primary"><Icon size={20} aria-hidden="true" /></span>
                            <div className="min-w-0">
                              <Link to={`/current-stock/${encodeURIComponent(row.ingredient.ingredient_id)}?date=${encodeURIComponent(date)}`} className="font-semibold text-brand-primary hover:underline">{row.ingredient.name}</Link>
                              <p className="mt-1 text-xs leading-relaxed text-stone-500">{[row.ingredient.ingredient_id, section, sub].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold">{formatQuantity(row.opening, unit)}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-emerald-700">+{formatQuantity(row.stockIn, unit)}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-red-700">{row.resultStatus === "CHECK" ? "Perlu diperiksa" : formatQuantity(row.usage, unit)}</td>
                        <td className={`whitespace-nowrap px-4 py-4 font-semibold ${row.adjustment < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {row.adjustment >= 0 ? "+" : "-"}{formatQuantity(Math.abs(row.adjustment), unit)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold">{formatQuantity(row.expected, unit)}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold">{row.physical === null ? "-" : formatQuantity(row.physical, unit)}</td>
                        <td className={`whitespace-nowrap px-4 py-4 font-bold ${hasVariance ? "text-amber-700" : "text-emerald-700"}`}>
                          {row.variance === null ? "-" : `${row.variance > 0 ? "+" : ""}${formatQuantity(row.variance, unit)}`}
                        </td>
                        <td className="rounded-r-2xl px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${row.resultStatus === "PENDING" ? "bg-yellow-200 text-yellow-900" : hasVariance ? "bg-amber-100 text-amber-800" : "bg-brand-sage text-brand-primary"}`}>
                            {row.resultStatus === "PENDING" ? <AlertTriangle size={13} /> : hasVariance ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div> : loading ? <p className="p-14 text-center text-sm text-stone-500">{t("Loading reconciliation...")}</p> : !visibleRows.length ? <p className="p-14 text-center text-sm text-stone-500">{t("No reconciliation data found")}</p> : <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
              {visibleRows.map((row) => {
                const unit = row.ingredient.base_unit_info?.code ?? row.ingredient.base_unit ?? "";
                const section = inventorySectionLabel(row.ingredient.category_ingredient_name);
                const sub = subcategories.find((item) => item.subcategory_ingredient_id === row.ingredient.subcategory_ingredient_id)?.name;
                const Icon = section === "Barista" ? Bean : Package;
                const hasVariance = row.resultStatus === "VARIANCE" || row.resultStatus === "CHECK";
                    const statusText = row.resultStatus === "RECORDED" ? "Pemakaian tercatat" : row.resultStatus === "CHECK" ? "Perlu diperiksa" : row.resultStatus === "PENDING" ? t("Waiting") : hasVariance ? t("Variance") : t("Matched");
                return <article key={row.ingredient.ingredient_id} className="rounded-2xl bg-brand-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-cream text-brand-primary"><Icon size={20} aria-hidden="true" /></span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${row.resultStatus === "PENDING" ? "bg-yellow-200 text-yellow-900" : hasVariance ? "bg-amber-100 text-amber-800" : "bg-brand-sage text-brand-primary"}`}>{statusText}</span>
                  </div>
                  <Link to={`/current-stock/${encodeURIComponent(row.ingredient.ingredient_id)}?date=${encodeURIComponent(date)}`} className="mt-3 block font-semibold text-brand-primary hover:underline">{row.ingredient.name}</Link>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{[row.ingredient.ingredient_id, section, sub].filter(Boolean).join(" · ")}</p>
                  <dl className="mt-4 space-y-2 text-sm">
                    {[
                      { label: "Opening Stock", value: formatQuantity(row.opening, unit), color: "" },
                      { label: "Stock In", value: `+${formatQuantity(row.stockIn, unit)}`, color: "text-emerald-700" },
                      { label: "Pemakaian", value: row.resultStatus === "CHECK" ? "Perlu diperiksa" : formatQuantity(row.usage, unit), color: "text-red-700" },
                      { label: "Adjustments", value: `${row.adjustment >= 0 ? "+" : "-"}${formatQuantity(Math.abs(row.adjustment), unit)}`, color: row.adjustment < 0 ? "text-red-700" : "text-emerald-700" },
                    ].map((item) => <div key={item.label} className="flex flex-wrap justify-between gap-2"><dt className="text-stone-500">{t(item.label)}</dt><dd className={`font-semibold ${item.color}`}>{item.value}</dd></div>)}
                  </dl>
                  <dl className="mt-4 space-y-3 rounded-xl bg-brand-cream p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2"><dt className="text-stone-500">{t("Expected Closing")}</dt><dd className="font-semibold text-brand-primary">{formatQuantity(row.expected, unit)}</dd></div>
                    <div className="flex flex-wrap justify-between gap-2"><dt className="text-stone-500">{t("Physical Closing")}</dt><dd className="font-semibold text-brand-primary">{row.physical === null ? "—" : formatQuantity(row.physical, unit)}</dd></div>
                    <div className="flex flex-wrap justify-between gap-2 border-t border-stone-200 pt-3"><dt className="font-semibold">{t("Variance")}</dt><dd className={`font-bold ${row.variance === null ? "text-stone-500" : hasVariance ? "text-amber-700" : "text-emerald-700"}`}>{row.variance === null ? "—" : `${row.variance > 0 ? "+" : ""}${formatQuantity(row.variance, unit)}`}</dd></div>
                  </dl>
                </article>;
              })}
            </div>}
          </section>
        </main>
      </section>
    </div>
  );
}
