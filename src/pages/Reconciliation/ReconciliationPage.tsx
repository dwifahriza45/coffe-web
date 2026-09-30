import { AlertTriangle, CheckCircle2, RefreshCw, Scale, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getBusinessDays } from "../../api/businessDay.api";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { getInventoryCountItems } from "../../api/inventoryCountItem.api";
import { getStockMovements } from "../../api/stockMovement.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate, formatBusinessDate } from "../../utils/businessDate";
import { formatNumber } from "../../utils/numberFormat";

type ReconciliationRow = {
  ingredient: Ingredient;
  opening: number;
  stockIn: number;
  stockOut: number;
  adjustment: number;
  expected: number;
  physical: number | null;
  variance: number | null;
};

function toNumber(value?: string) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: number, unit?: string) {
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [date, setDate] = useState(searchParams.get("date") || currentBusinessDate());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [businessDayID, setBusinessDayID] = useState("");
  const [closingSubmitted, setClosingSubmitted] = useState(false);
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
        const dayResponse = await getBusinessDays({ start: 0, limit: 1, status: "", business_date: date });
        if (!current) return;
        const day = dayResponse.data?.[0];
        setBusinessDayID(day?.business_day_id ?? "");
        if (!day) {
          setRows([]);
          setClosingSubmitted(false);
          return;
        }

        const [ingredientResponse, countResponse, movementResponse] = await Promise.all([
          getIngredients({ start: 0, limit: 100, name: "" }),
          getInventoryCounts({
            start: 0,
            limit: 10,
            business_day_id: day.business_day_id,
            count_type: "",
            status: "SUBMITTED",
            name: "",
          }),
          getStockMovements({
            start: 0,
            limit: 100,
            business_day_id: day.business_day_id,
            business_date: date,
            movement_type: "",
            name: "",
          }),
        ]);
        if (!current) return;

        const counts = countResponse.data ?? [];
        const openingCount = counts.find((count) => count.count_type === "OPENING");
        const closingCount = counts.find((count) => count.count_type === "CLOSING");
        setClosingSubmitted(Boolean(closingCount));

        const [openingItems, closingItems] = await Promise.all([
          openingCount
            ? getInventoryCountItems({
              start: 0,
              limit: 100,
              inventory_count_id: openingCount.inventory_count_id,
              ingredient_id: "",
              name: "",
            })
            : Promise.resolve({ data: [] }),
          closingCount
            ? getInventoryCountItems({
              start: 0,
              limit: 100,
              inventory_count_id: closingCount.inventory_count_id,
              ingredient_id: "",
              name: "",
            })
            : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;

        const openingByIngredient = new Map<string, number>();
        const physicalByIngredient = new Map<string, number>();
        (openingItems.data ?? []).forEach((item) => {
          openingByIngredient.set(item.ingredient_id, toNumber(item.actual_quantity));
        });
        (closingItems.data ?? []).forEach((item) => {
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
          const opening = openingByIngredient.get(ingredient.ingredient_id) ?? 0;
          const expected = opening + movement.stockIn - movement.stockOut + movement.adjustment;
          const physical = physicalByIngredient.has(ingredient.ingredient_id)
            ? physicalByIngredient.get(ingredient.ingredient_id) ?? 0
            : null;
          return {
            ingredient,
            opening,
            stockIn: movement.stockIn,
            stockOut: movement.stockOut,
            adjustment: movement.adjustment,
            expected,
            physical,
            variance: physical === null ? null : physical - expected,
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

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => row.ingredient.name.toLowerCase().includes(keyword));
  }, [rows, search]);

  const varianceRows = rows.filter((row) => row.variance !== null && row.variance !== 0);
  const pendingRows = rows.filter((row) => row.physical === null);
  const reviewed = closingSubmitted && pendingRows.length === 0;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[#efe9df] text-[#8a5a3f]">
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
                <p className="mt-2 text-2xl font-bold">{rows.length - pendingRows.length}/{rows.length}</p>
              </div>
              <div className={`rounded-lg px-4 py-3 ${varianceRows.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">{t("Variance Items")}</p>
                <p className="mt-2 text-2xl font-bold">{varianceRows.length}</p>
              </div>
              <div className={`rounded-lg px-4 py-3 ${reviewed ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-700"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">{t("Reconciliation Status")}</p>
                <p className="mt-2 text-2xl font-bold">{reviewed ? t("Ready to Review") : t("Waiting for Closing Stock")}</p>
              </div>
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    {["Ingredient", "Opening Stock", "Stock In", "Stock Out", "Adjustments", "Expected Closing", "Physical Closing", "Variance", "Status"].map((label) => (
                      <th key={label} className="px-5 py-3">{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={9} className="px-5 py-14 text-center text-stone-500">{t("Loading reconciliation...")}</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-14 text-center text-stone-500">{t("No reconciliation data found")}</td></tr>
                  ) : visibleRows.map((row) => {
                    const unit = row.ingredient.base_unit_info?.code ?? row.ingredient.base_unit ?? "";
                    const hasVariance = row.variance !== null && row.variance !== 0;
                    return (
                      <tr key={row.ingredient.ingredient_id} className="hover:bg-stone-50">
                        <td className="px-5 py-4">
                          <Link to={`/current-stock/${row.ingredient.ingredient_id}?date=${encodeURIComponent(date)}`} className="font-semibold text-stone-900 hover:text-[#92502f] hover:underline">
                            {row.ingredient.name}
                          </Link>
                          <p className="mt-1 text-xs text-stone-400">{row.ingredient.ingredient_id}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold">{formatQuantity(row.opening, unit)}</td>
                        <td className="px-5 py-4 font-semibold text-emerald-700">+{formatQuantity(row.stockIn, unit)}</td>
                        <td className="px-5 py-4 font-semibold text-red-700">-{formatQuantity(row.stockOut, unit)}</td>
                        <td className={`px-5 py-4 font-semibold ${row.adjustment < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {row.adjustment >= 0 ? "+" : "-"}{formatQuantity(Math.abs(row.adjustment), unit)}
                        </td>
                        <td className="px-5 py-4 font-bold">{formatQuantity(row.expected, unit)}</td>
                        <td className="px-5 py-4 font-bold">{row.physical === null ? "-" : formatQuantity(row.physical, unit)}</td>
                        <td className={`px-5 py-4 font-bold ${hasVariance ? "text-amber-700" : "text-emerald-700"}`}>
                          {row.variance === null ? "-" : `${row.variance > 0 ? "+" : ""}${formatQuantity(row.variance, unit)}`}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${row.physical === null ? "bg-stone-100 text-stone-600" : hasVariance ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {row.physical === null ? <AlertTriangle size={13} /> : hasVariance ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                            {row.physical === null ? t("Waiting") : hasVariance ? t("Variance") : t("Matched")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
