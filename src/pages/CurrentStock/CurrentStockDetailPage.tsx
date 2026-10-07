import { ArrowLeft, Boxes } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getIngredient, type Ingredient } from "../../api/ingredient.api";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { getInventoryCountItems } from "../../api/inventoryCountItem.api";
import { getStockMovements, type StockMovement } from "../../api/stockMovement.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate, formatBusinessDate } from "../../utils/businessDate";
import { formatNumber } from "../../utils/numberFormat";

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

export default function CurrentStockDetailPage() {
  const { ingredientID = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const date = searchParams.get("date") || currentBusinessDate();
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState<number | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const [ingredientResponse, countResponse, movementResponse] =
          await Promise.all([
            getIngredient(ingredientID),
            getInventoryCounts({
              start: 0,
              limit: 10,
              business_day_id: "",
              count_type: "",
              status: "",
              name: "",
            }),
            getStockMovements({
              start: 0,
              limit: 100,
              business_day_id: "",
              business_date: date,
              ingredient_id: ingredientID,
              movement_type: "",
              name: "",
            }),
          ]);
        if (!current) return;
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
              ingredient_id: ingredientID,
              name: "",
            })
            : Promise.resolve({ data: [] }),
          closingCount
            ? getInventoryCountItems({
              start: 0,
              limit: 100,
              inventory_count_id: closingCount.inventory_count_id,
              ingredient_id: ingredientID,
              name: "",
            })
            : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;
        setIngredient(ingredientResponse.data ?? null);
        setOpening(openingItems.data?.[0]?.section_status === "SUBMITTED" ? toNumber(openingItems.data[0].actual_quantity) : 0);
        setClosing(closingItems.data?.[0]?.section_status === "SUBMITTED" ? toNumber(closingItems.data[0].actual_quantity) : null);
        setMovements(movementResponse.data ?? []);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setError(response?.message || t("Could not load current stock detail."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      current = false;
    };
  }, [date, ingredientID, t]);

  const unit = ingredient?.base_unit_info?.code ?? ingredient?.base_unit ?? "";
  const unitName = ingredient?.base_unit_info?.name ?? ingredient?.base_unit ?? "-";
  const minimum = toNumber(ingredient?.minimum_stock);
  const summary = useMemo(() => {
    const stockIn = movements.filter((item) => isStockIn(item.movement_type));
    const stockOut = movements.filter((item) => isStockOut(item.movement_type));
    const adjustments = movements.filter((item) => isAdjustment(item.movement_type));
    const stockInTotal = stockIn.reduce((total, item) => total + toNumber(item.quantity), 0);
    const stockOutTotal = stockOut.reduce((total, item) => total + toNumber(item.quantity), 0);
    const adjustmentTotal = adjustments.reduce(
      (total, item) => total + movementSign(item.movement_type) * toNumber(item.quantity),
      0,
    );
    const calculatedCurrent = opening + stockInTotal - stockOutTotal + adjustmentTotal;
    const current = closing ?? calculatedCurrent;
    return { stockIn, stockOut, adjustments, stockInTotal, stockOutTotal, adjustmentTotal, calculatedCurrent, current };
  }, [movements, opening, closing]);
  const low = summary.current < minimum;
  const difference = summary.current - minimum;
  const currentSource = closing === null ? t("Calculated from Opening Stock") : t("Taken from Closing Stock");
  const dateQuery = `date=${encodeURIComponent(date)}`;
  const summaryCardClass = "rounded-lg bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]/30";

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={`/current-stock?date=${date}`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={17} />
            {t("Current Stock")}
          </Link>

          {error && <div className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            {loading ? (
              <p className="text-sm text-stone-500">{t("Loading current stock...")}</p>
            ) : (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]">
                      <Boxes size={22} />
                    </div>
                    <h1 className="font-serif text-3xl font-bold">{ingredient?.name ?? ingredientID}</h1>
                    <p className="mt-2 text-sm text-stone-500">{ingredientID}</p>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${low ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    <span className={`size-1.5 rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} />
                    {low ? t("Low Stock") : t("Sufficient")}
                  </span>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Current Stock")}</p>
                    <p className="mt-2 text-2xl font-bold text-stone-950">{formatQuantity(summary.current, unit)}</p>
                    <p className="mt-1 text-xs font-semibold text-stone-500">{currentSource}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Minimum Stock")}</p>
                    <p className="mt-2 text-lg font-semibold">{formatQuantity(minimum, unit)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{difference >= 0 ? t("Difference Above Minimum") : t("Difference Below Minimum")}</p>
                    <p className={`mt-2 text-lg font-semibold ${difference >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {difference >= 0 ? "+" : ""}{formatQuantity(difference, unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Base Unit")}</p>
                    <p className="mt-2 text-lg font-semibold">{unitName}</p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="mt-5 rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t("Today's Stock Summary")}</h2>
                <p className="mt-1 text-sm text-stone-500">{t("Business Day")}: {formatBusinessDate(date)}</p>
              </div>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-600">
                {formatBusinessDate(date)}
              </span>
            </div>
            <p className="mt-3 text-sm text-stone-500">
              {closing === null
                ? t("Current Stock is calculated from Opening Stock plus submitted movements because Closing Stock has not been submitted.")
                : t("Current Stock is taken from submitted Closing Stock.")}
            </p>
            <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr]">
                <Link to={`/stock-count/opening?${dateQuery}`} className={summaryCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Opening Stock")}</p>
                  <p className="mt-2 text-xl font-bold text-stone-950">{formatQuantity(opening, unit)}</p>
                </Link>
                <Link to={`/supplier-management?${dateQuery}`} className={summaryCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{t("Stock In")}</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">+{formatQuantity(summary.stockInTotal, unit)}</p>
                </Link>
                <Link to={`/stock-movements?${dateQuery}`} className={summaryCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-700">{t("Stock Out")}</p>
                  <p className="mt-2 text-xl font-bold text-red-700">-{formatQuantity(summary.stockOutTotal, unit)}</p>
                </Link>
                <Link to={`/stock-adjustments?${dateQuery}`} className={summaryCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Adjustments")}</p>
                  <p className={`mt-2 text-xl font-bold ${summary.adjustmentTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {summary.adjustmentTotal >= 0 ? "+" : "-"}{formatQuantity(Math.abs(summary.adjustmentTotal), unit)}
                  </p>
                </Link>
                <div className="rounded-lg border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-cream)] px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-accent)]">{t("Current Stock")}</p>
                  <div className="mt-2">
                    <p className="text-xl font-bold text-[var(--color-brand-primary)]">{formatQuantity(summary.current, unit)}</p>
                    <p className="mt-1 text-xs font-semibold text-stone-500">{currentSource}</p>
                  </div>
                </div>
              </div>
              {closing === null && (
                <p className="mt-3 text-xs font-semibold text-stone-500">
                  {t("Formula")}: {formatQuantity(opening, unit)} + {formatQuantity(summary.stockInTotal, unit)} - {formatQuantity(summary.stockOutTotal, unit)} {summary.adjustmentTotal < 0 ? "-" : "+"} {formatQuantity(Math.abs(summary.adjustmentTotal), unit)} = {formatQuantity(summary.current, unit)}
                </p>
              )}
              {closing !== null && (
                <p className="mt-3 text-xs font-semibold text-stone-500">
                  {t("Closing Stock")}: {formatQuantity(closing, unit)}
                </p>
              )}
            </div>

            {(summary.stockIn.length > 0 || summary.stockOut.length > 0 || summary.adjustments.length > 0) && (
              <div className="mt-5 space-y-4 text-sm">
                {summary.stockIn.length > 0 && (
                  <div>
                    <p className="font-semibold">{t("Stock In")}</p>
                    {summary.stockIn.map((item) => (
                      <div key={item.stock_movement_id} className="mt-2 flex max-w-xl justify-between gap-4 text-stone-600">
                        <span>+ {item.po_number || item.reference_id}</span>
                        <span>{formatQuantity(toNumber(item.quantity), unit)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {summary.stockOut.length > 0 && (
                  <div>
                    <p className="font-semibold">{t("Stock Out")}</p>
                    {summary.stockOut.map((item) => (
                      <div key={item.stock_movement_id} className="mt-2 flex max-w-xl justify-between gap-4 text-stone-600">
                        <span>- {t(item.movement_type)}</span>
                        <span>{formatQuantity(toNumber(item.quantity), unit)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {summary.adjustments.length > 0 && (
                  <div>
                    <p className="font-semibold">{t("Adjustments")}</p>
                    {summary.adjustments.map((item) => {
                      const sign = movementSign(item.movement_type);
                      return (
                        <div key={item.stock_movement_id} className="mt-2 flex max-w-xl justify-between gap-4 text-stone-600">
                          <span>{sign > 0 ? "+" : "-"} {t(item.movement_type)}</span>
                          <span>{formatQuantity(toNumber(item.quantity), unit)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </section>
    </div>
  );
}
