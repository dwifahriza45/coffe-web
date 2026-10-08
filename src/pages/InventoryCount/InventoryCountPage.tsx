import { exportStockCountReport } from "../../utils/stockCountReport";
import { getStockCountSections, type StockCountSection } from "../../api/inventoryCount.api";
import StockCountDepartments from "../../components/common/StockCountDepartments";
import { getStockCountDepartment } from "../../utils/stockCountDepartment";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";
import { Activity, ArrowLeft, ArrowRight, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import { getInventoryCounts, type InventoryCount } from "../../api/inventoryCount.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useLanguage } from "../../app/LanguageContext";

function formatBusinessDate(value: string | undefined) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function InventoryCountPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canReadOpening = userCan(user, "inventory_opening_counts");
  const canReadClosing = userCan(user, "inventory_closing_counts");
  const { businessDayID: routeBusinessDayID = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const businessDayID = routeBusinessDayID || searchParams.get("businessDayID") || "";
  const queryDate = searchParams.get("date") ?? "";
  const focusStep = searchParams.get("focus") ?? "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionStates, setSectionStates] = useState<Record<string, StockCountSection[]>>({});
  const [items, setItems] = useState<InventoryCount[]>([]);
  const [businessDay, setBusinessDay] = useState<BusinessDay | null>(null);
  const [selectedDate, setSelectedDate] = useState(queryDate || today());
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessDayID && !queryDate) {
      setSearchParams((current) => { const next = new URLSearchParams(current); next.set("date", selectedDate); return next; }, { replace: true });
    }
    if (!businessDayID && queryDate && queryDate !== selectedDate) {
      setSelectedDate(queryDate);
    }
  }, [businessDayID, queryDate, selectedDate, setSearchParams]);

  useEffect(() => {
    let current = true;
    async function loadCounts() {
      setLoading(true);
      setError("");
      try {
        let dayID = businessDayID;
        if (!dayID) {
          const days = await getBusinessDays({ start: 0, limit: 1, status: "", business_date: selectedDate });
          dayID = days.data?.[0]?.business_day_id || "";
        }
        if (!current) return;
        if (!dayID) { setItems([]); return; }
        const response = await getInventoryCounts({
          start: 0, limit: 10, business_day_id: dayID,
          count_type: "", status: "", name: "",
        });
        if (!current) return;
        const nextItems = response.data ?? [];
        const states = await Promise.all(nextItems.map(async (count) => {
          const response = await getStockCountSections(count.inventory_count_id);
          return [count.inventory_count_id, response.data?.sections ?? []] as const;
        }));
        if (!current) return;
        setSectionStates(Object.fromEntries(states));
        setItems(nextItems);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setError(response?.message || t("Could not load inventory counts."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCounts();
    return () => {
      current = false;
    };
  }, [businessDayID, selectedDate, t]);

  useEffect(() => {
    let current = true;
    async function loadBusinessDay() {
      if (!businessDayID) {
        try {
          const response = await getBusinessDays({ start: 0, limit: 1, status: "", business_date: selectedDate });
          if (current) setBusinessDay(response.data?.[0] ?? null);
        } catch {
          if (current) setBusinessDay(null);
        }
        return;
      }
      try {
        const response = await getBusinessDays({ start: 0, limit: 100, status: "", business_date: "" });
        const found = response.data?.find((day) => day.business_day_id === businessDayID) ?? null;
        if (current) setBusinessDay(found);
      } catch {
        if (current) setBusinessDay(null);
      }
    }
    void loadBusinessDay();
    return () => {
      current = false;
    };
  }, [businessDayID, selectedDate]);

  const department = getStockCountDepartment(searchParams.get("department"));
  const orderedItems = items.map((item) => ({...item, status: department ? sectionStates[item.inventory_count_id]?.find((section) => section.department === department.key)?.status ?? item.status : item.status})).sort((first, second) => {
    const order = { OPENING: 0, CLOSING: 1 };
    return order[first.count_type] - order[second.count_type];
  });
  const openingCount = orderedItems.find((item) => item.count_type === "OPENING");
  const closingCount = orderedItems.find((item) => item.count_type === "CLOSING");
  const openingSubmitted = openingCount?.status === "SUBMITTED";
  const closingSubmitted = closingCount?.status === "SUBMITTED";
  const showWorkflow = !loading && items.length > 0;
  const scopedBusinessDayID = businessDayID || businessDay?.business_day_id || "";
  const scopedBusinessDate = businessDay?.business_date || selectedDate;
  const workflowQuery = new URLSearchParams({
    ...(department ? { department: department.key } : {}),
    ...(scopedBusinessDayID ? { businessDayID: scopedBusinessDayID } : {}),
    date: scopedBusinessDate,
  });
  const adjustmentPath = scopedBusinessDayID
    ? `/stock-adjustments?${workflowQuery}`
    : `/stock-adjustments?date=${encodeURIComponent(scopedBusinessDate)}`;
  const movementPath = scopedBusinessDayID
    ? `/stock-movements?${workflowQuery}`
    : `/stock-movements?date=${encodeURIComponent(scopedBusinessDate)}`;

  function countPath(item: InventoryCount) {
    const query = new URLSearchParams({ businessDayID: item.business_day_id, date: item.business_day_info?.business_date || scopedBusinessDate, ...(department ? { department: department.key } : {}), focus: item.count_type.toLowerCase() });
    return `/business-days/${item.business_day_id}/inventory-counts/${item.inventory_count_id}?${query}`;
  }

  function nextAction() {
    const target = !openingSubmitted && openingCount ? openingCount : closingCount ?? openingCount;
    if (!target) return { label: t("Waiting for stock count"), path: "" };
    const key = target.count_type === "OPENING" ? "inventory_opening_counts" : "inventory_closing_counts";
    const label = target.status === "DRAFT" && userCan(user, key, "update")
      ? t(target.count_type === "OPENING" ? "Submit opening stock" : "Submit closing stock")
      : t("Open");
    return { label, path: countPath(target) };
  }

  const action = nextAction();

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header>
            {businessDayID && (
              <Link to="/business-days" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
                <ArrowLeft size={17} />
                {t("Business Days")}
              </Link>
            )}
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]">
              <ClipboardCheck size={22} />
            </div>
            <h1 className="font-serif text-3xl font-bold">{t("Stock Count")}{department ? ` · ${department.label}` : ""}</h1>
            <button type="button" disabled={loading || exporting || !items.length} onClick={async () => {
 setExporting(true); setError("");
 try { await exportStockCountReport({ counts: items.filter((item) => item.count_type === "OPENING" ? canReadOpening : canReadClosing), dayID: scopedBusinessDayID || items[0]?.business_day_id || "", date: scopedBusinessDate, department: department?.key }); }
 catch (err) { setError(isAxiosError<{message?:string}>(err) ? err.response?.data?.message || "Gagal export laporan stock opname" : "Gagal export laporan stock opname"); }
 finally { setExporting(false); }
 }} className="mt-4 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{exporting ? "Menyiapkan laporan…" : "Export Laporan Excel"}</button>
            <StockCountDepartments />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-stone-500">{formatBusinessDate(businessDay?.business_date) || (businessDayID ? businessDayID : formatBusinessDate(selectedDate))}</p>
              {!businessDayID && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Business Date")}
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      const nextDate = event.target.value || today();
                      setSelectedDate(nextDate);
                      setSearchParams((current) => { const next = new URLSearchParams(current); next.set("date", nextDate); next.delete("businessDayID"); return next; });
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-700 outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"
                  />
                </label>
              )}
            </div>
          </header>

          <section className="mt-7 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            {error && <div className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {loading ? (
              <div className="p-6 text-sm text-stone-500">{t("Loading stock counts...")}</div>
            ) : !showWorkflow ? (
              <div className="p-6 text-sm text-stone-500">
                {businessDay ? t("No stock counts found for this date") : t("No business day found for this date")}
              </div>
            ) : (
              <>
              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t("Daily workflow")}</p>
                  <h2 className="mt-1 text-xl font-bold text-stone-950">
                    {!canReadOpening ? t("Closing Stock") : !canReadClosing ? t("Opening Stock") : openingSubmitted ? closingSubmitted ? t("Stock count complete") : t("Continue daily inventory") : t("Start with Opening Stock")}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {!canReadOpening ? t("Count ending stock.") : !canReadClosing ? t("Count beginning stock.") : openingSubmitted
                      ? closingSubmitted
                        ? t("Opening and Closing Stock have been submitted.")
                        : t("Record Adjustment when needed. If there is none, continue to Closing Stock.")
                      : t("Count physical stock before operational activities begin.")}
                  </p>
                </div>
                {action.path ? (
                  <Link to={action.path} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white">
                    {action.label}
                    <ArrowRight size={17} />
                  </Link>
                ) : (
                  <button disabled className="rounded-lg bg-stone-200 px-5 py-3 text-sm font-semibold text-stone-500">{action.label}</button>
                )}
              </div>
              <div className="divide-y divide-stone-100 border-t border-stone-100 text-sm">
                {canReadOpening && (openingCount ? (
                <Link to={countPath(openingCount)} className={`flex gap-4 px-5 py-4 transition hover:bg-stone-50 ${focusStep === "opening" ? "bg-amber-50/60 ring-1 ring-inset ring-amber-200" : ""}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${openingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>1</span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-900">{t("Opening Stock")}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${openingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {openingSubmitted ? t("Done") : t("Draft")}
                        </span>
                      </div>
                      <p className="mt-1 text-stone-500">{t("Count beginning stock.")}</p>
                    </div>
                    <p className={openingSubmitted ? "mt-2 shrink-0 font-semibold text-emerald-700 sm:mt-0" : "mt-2 shrink-0 font-semibold text-amber-700 sm:mt-0"}>{openingSubmitted ? t("Submitted") : t("Not submitted")}</p>
                  </div>
                </Link>
                ) : (
                <div className={`flex gap-4 px-5 py-4 ${focusStep === "opening" ? "bg-amber-50/60 ring-1 ring-inset ring-amber-200" : ""}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">1</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{t("Opening Stock")}</p>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                        {t("Draft")}
                      </span>
                    </div>
                    <p className="mt-1 text-stone-500">{t("Count beginning stock.")}</p>
                  </div>
                </div>
                ))}
                {userCan(user, "stock_adjustments") && (
                <Link to={adjustmentPath} className="flex gap-4 px-5 py-4 hover:bg-stone-50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">2</span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-stone-900"><SlidersHorizontal size={16} /> {t("Adjustment")}</p>
                      <p className="mt-1 text-stone-500">{t("Correct stock when needed.")}</p>
                    </div>
                    <p className="mt-2 shrink-0 font-semibold text-stone-700 sm:mt-0">{t("Optional")}</p>
                  </div>
                </Link>
                )}
                {userCan(user, "stock_movements") && (
                <Link to={movementPath} className="flex gap-4 px-5 py-4 hover:bg-stone-50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">3</span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-stone-900"><Activity size={16} /> {t("Movement")}</p>
                      <p className="mt-1 text-stone-500">{t("Review the ledger.")}</p>
                    </div>
                    <p className="mt-2 shrink-0 font-semibold text-stone-700 sm:mt-0">{t("Review")}</p>
                  </div>
                </Link>
                )}
                {canReadClosing && (closingCount ? (
                <Link to={countPath(closingCount)} className={`flex gap-4 px-5 py-4 transition hover:bg-stone-50 ${focusStep === "closing" ? "bg-amber-50/60 ring-1 ring-inset ring-amber-200" : ""}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${closingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>4</span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-900">{t("Closing Stock")}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${closingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {closingSubmitted ? t("Done") : t("Draft")}
                        </span>
                      </div>
                      <p className="mt-1 text-stone-500">{t("Count ending stock.")}</p>
                    </div>
                    <p className={closingSubmitted ? "mt-2 shrink-0 font-semibold text-emerald-700 sm:mt-0" : "mt-2 shrink-0 font-semibold text-amber-700 sm:mt-0"}>{closingSubmitted ? t("Submitted") : t("Not submitted")}</p>
                  </div>
                </Link>
                ) : (
                <div className={`flex gap-4 px-5 py-4 ${focusStep === "closing" ? "bg-amber-50/60 ring-1 ring-inset ring-amber-200" : ""}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">4</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{t("Closing Stock")}</p>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                        {t("Draft")}
                      </span>
                    </div>
                    <p className="mt-1 text-stone-500">{t("Count ending stock.")}</p>
                  </div>
                </div>
                ))}
              </div>
              </>
            )}
          </section>

        </main>
      </section>
    </div>
  );
}
