import { Boxes, RefreshCw, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { getInventoryCountItems } from "../../api/inventoryCountItem.api";
import { getStockMovements } from "../../api/stockMovement.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate } from "../../utils/businessDate";
import { formatNumber } from "../../utils/numberFormat";

type CurrentStockRow = {
  ingredient: Ingredient;
  current: number;
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

export default function CurrentStockPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [date, setDate] = useState(searchParams.get("date") || currentBusinessDate());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CurrentStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!searchParams.get("date")) {
      setSearchParams({ date }, { replace: true });
    }
  }, [date, searchParams, setSearchParams]);

  useEffect(() => {
    let current = true;
    async function loadCurrentStock() {
      setLoading(true);
      setError("");
      try {
        const [ingredientResponse, countResponse, movementResponse] =
          await Promise.all([
            getIngredients({ start: 0, limit: 100, name: "" }),
            getInventoryCounts({
              start: 0,
              limit: 10,
              business_day_id: "",
              count_type: "",
              status: "SUBMITTED",
              name: "",
            }),
            getStockMovements({
              start: 0,
              limit: 100,
              business_day_id: "",
              business_date: date,
              movement_type: "",
              name: "",
            }),
          ]);
        if (!current) return;

        const ingredients = (ingredientResponse.data ?? []).filter(
          (ingredient) => ingredient.active,
        );
        const countsForDate = (countResponse.data ?? []).filter(
          (count) => count.business_day_info?.business_date === date,
        );
        const openingCount = countsForDate.find((count) => count.count_type === "OPENING");
        const closingCount = countsForDate.find((count) => count.count_type === "CLOSING");
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

        const quantityByIngredient = new Map<string, number>();
        (openingItems.data ?? []).forEach((item) => {
          quantityByIngredient.set(
            item.ingredient_id,
            toNumber(item.actual_quantity),
          );
        });
        (movementResponse.data ?? []).forEach((movement) => {
          const currentQuantity =
            quantityByIngredient.get(movement.ingredient_id) ?? 0;
          quantityByIngredient.set(
            movement.ingredient_id,
            currentQuantity + movementSign(movement.movement_type) * toNumber(movement.quantity),
          );
        });
        (closingItems.data ?? []).forEach((item) => {
          quantityByIngredient.set(
            item.ingredient_id,
            toNumber(item.actual_quantity),
          );
        });

        setRows(
          ingredients.map((ingredient) => ({
            ingredient,
            current: quantityByIngredient.get(ingredient.ingredient_id) ?? 0,
          })),
        );
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setRows([]);
        setError(response?.message || t("Could not load current stock."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCurrentStock();
    return () => {
      current = false;
    };
  }, [date, refresh, t]);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      row.ingredient.name.toLowerCase().includes(keyword),
    );
  }, [rows, search]);

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[#efe9df] text-[#8a5a3f]">
                <Boxes size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("Current Stock")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Current quantity from opening stock and submitted stock movements.")}
              </p>
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

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-stone-500">
                {visibleRows.length} {t("ingredients")}
              </p>
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
                    setSearch(searchInput);
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
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Ingredient")}</th>
                    <th className="px-5 py-3">{t("Current")}</th>
                    <th className="px-5 py-3">{t("Minimum")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("Loading current stock...")}
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("No current stock found")}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map(({ ingredient, current }) => {
                      const minimum = toNumber(ingredient.minimum_stock);
                      const low = current < minimum;
                      const unit = ingredient.base_unit_info?.code ?? ingredient.base_unit;
                      return (
                        <tr
                          key={ingredient.ingredient_id}
                          onClick={() => navigate(`/current-stock/${ingredient.ingredient_id}?date=${date}`)}
                          className="group cursor-pointer hover:bg-stone-50/70"
                        >
                          <td className="px-5 py-4 text-sm font-semibold">
                            <span className="inline-flex transition-colors group-hover:text-[#92502f] group-hover:underline group-hover:underline-offset-4">
                              {ingredient.name}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm">{formatQuantity(current, unit)}</td>
                          <td className="px-5 py-4 text-sm">{formatQuantity(minimum, unit)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${low ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                              <span className={`size-1.5 rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} />
                              {low ? t("Low Stock") : t("Sufficient")}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
