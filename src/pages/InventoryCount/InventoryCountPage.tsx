import { Activity, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, PackagePlus, SlidersHorizontal } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import { getInventoryCounts, type InventoryCount } from "../../api/inventoryCount.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("en-GB") : "-";
}

function formatBusinessDate(value?: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
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

function countTitle(type: InventoryCount["count_type"]) {
  return type === "OPENING" ? "Opening Stock" : "Closing Stock";
}

function countDescription(type: InventoryCount["count_type"]) {
  return type === "OPENING"
    ? "Physical stock before operational activities"
    : "Physical stock after operational activities";
}

export default function InventoryCountPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const inventoryOnly = roles.includes("inventory") && !roles.some((role) => ["admin", "leader"].includes(role));
  const { businessDayID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<InventoryCount[]>([]);
  const [businessDay, setBusinessDay] = useState<BusinessDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function loadCounts() {
      setLoading(true);
      setError("");
      try {
        const response = await getInventoryCounts({
          start: 0,
          limit: businessDayID ? 10 : 100,
          business_day_id: businessDayID,
          count_type: "",
          status: "",
          name: "",
        });
        if (!current) return;
        const nextItems = businessDayID
          ? response.data ?? []
          : (response.data ?? []).filter((item) => item.business_day_info?.business_date === today());
        setItems(nextItems);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setError(response?.message || "Could not load inventory counts.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCounts();
    return () => {
      current = false;
    };
  }, [businessDayID]);

  useEffect(() => {
    let current = true;
    async function loadBusinessDay() {
      if (!businessDayID) {
        try {
          const response = await getBusinessDays({ start: 0, limit: 1, status: "OPEN", business_date: today() });
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
  }, [businessDayID]);

  const orderedItems = [...items].sort((first, second) => {
    const order = { OPENING: 0, CLOSING: 1 };
    return order[first.count_type] - order[second.count_type];
  });
  const openingCount = orderedItems.find((item) => item.count_type === "OPENING");
  const closingCount = orderedItems.find((item) => item.count_type === "CLOSING");
  const openingSubmitted = openingCount?.status === "SUBMITTED";
  const closingSubmitted = closingCount?.status === "SUBMITTED";
  const showWorkflow = !loading && items.length > 0;
  const scopedBusinessDayID = businessDayID || businessDay?.business_day_id || "";
  const scopedBusinessDate = businessDay?.business_date || today();
  const stockInPath = scopedBusinessDayID
    ? `/stock-in?businessDayID=${encodeURIComponent(scopedBusinessDayID)}&date=${scopedBusinessDate}`
    : "/stock-in";
  const movementPath = scopedBusinessDayID
    ? `/stock-movements?businessDayID=${encodeURIComponent(scopedBusinessDayID)}&date=${scopedBusinessDate}`
    : "/stock-movements";

  function countPath(item: InventoryCount) {
    return businessDayID
      ? `/business-days/${businessDayID}/inventory-counts/${item.inventory_count_id}`
      : `/stock-count/${item.inventory_count_id}`;
  }

  function nextAction() {
    if (!openingCount) return { label: "Waiting for stock count", path: "", disabled: true };
    if (!openingSubmitted) return { label: "Submit opening stock", path: countPath(openingCount), disabled: false };
    if (closingCount && !closingSubmitted) return { label: "Submit closing stock", path: countPath(closingCount), disabled: false };
    if (closingSubmitted) return { label: "View closing stock", path: countPath(closingCount), disabled: false };
    return { label: "Review stock movement", path: movementPath, disabled: false };
  }

  const action = nextAction();

  function renderCount(item: InventoryCount) {
    const submitted = item.status === "SUBMITTED";
    return (
      <Link key={item.inventory_count_id} to={countPath(item)} className="group grid gap-4 border-t border-stone-100 bg-white px-5 py-4 transition hover:bg-stone-50/70 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center">
        <div className={`grid size-10 place-items-center rounded-lg ${submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {submitted ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold transition-colors group-hover:text-[#92502f]">{countTitle(item.count_type)}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {submitted ? "Done" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">{countDescription(item.count_type)}</p>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span className="text-stone-500">Counted by <b className="font-semibold text-stone-800">{item.counted_by_info?.fullname ?? item.counted_by ?? "-"}</b></span>
            <span className="text-stone-500">Submitted <b className="font-semibold text-stone-800">{formatDateTime(item.counted_at)}</b></span>
          </div>
        </div>
        <span className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition group-hover:border-[#92502f] group-hover:text-[#92502f]">
          {submitted ? "View" : "Open"}
          <ArrowRight size={15} />
        </span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header>
            {businessDayID && (
              <Link to="/business-days" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
                <ArrowLeft size={17} />
                Business Days
              </Link>
            )}
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e8efe5] text-[#547144]">
              <ClipboardCheck size={22} />
            </div>
            <h1 className="font-serif text-3xl font-bold">Stock Count</h1>
            <p className="mt-2 text-sm text-stone-500">{formatBusinessDate(businessDay?.business_date) || (businessDayID ? businessDayID : formatBusinessDate(today()))}</p>
          </header>

          {showWorkflow && (
            <section className="mt-7 max-w-7xl rounded-xl border border-stone-200 bg-white">
              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{inventoryOnly ? "Today" : "Daily workflow"}</p>
                  <h2 className="mt-1 text-xl font-bold text-stone-950">
                    {openingSubmitted ? closingSubmitted ? "Stock count complete" : "Continue daily inventory" : "Start with Opening Stock"}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {openingSubmitted
                      ? closingSubmitted
                        ? "Opening and Closing Stock have been submitted."
                        : "Record Stock In or Adjustment when needed. If there is none, continue to Closing Stock."
                      : "Count physical stock before operational activities begin."}
                  </p>
                </div>
                {action.path ? (
                  <Link to={action.path} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
                    {action.label}
                    <ArrowRight size={17} />
                  </Link>
                ) : (
                  <button disabled className="rounded-lg bg-stone-200 px-5 py-3 text-sm font-semibold text-stone-500">{action.label}</button>
                )}
              </div>
              <div className="grid border-t border-stone-100 text-sm md:grid-cols-2 xl:grid-cols-5">
                <div className="flex gap-3 px-5 py-4">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${openingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>1</span>
                  <div>
                    <p className="font-semibold text-stone-900">Opening Stock</p>
                    <p className="mt-1 text-stone-500">Count beginning stock.</p>
                    <p className={openingSubmitted ? "mt-2 font-semibold text-emerald-700" : "mt-2 font-semibold text-amber-700"}>{openingSubmitted ? "Submitted" : "Not submitted"}</p>
                  </div>
                </div>
                <Link to={stockInPath} className="flex gap-3 border-t border-stone-100 px-5 py-4 hover:bg-stone-50 md:border-l md:border-t-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">2</span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-stone-900"><PackagePlus size={16} /> Stock In</p>
                    <p className="mt-1 text-stone-500">Use only when goods arrive.</p>
                    <p className="mt-2 font-semibold text-stone-700">Optional</p>
                  </div>
                </Link>
                <Link to={scopedBusinessDayID ? `/stock-adjustments?${new URLSearchParams({ businessDayID: scopedBusinessDayID, date: scopedBusinessDate })}` : "/stock-adjustments"} className="flex gap-3 border-t border-stone-100 px-5 py-4 hover:bg-stone-50 xl:border-l xl:border-t-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">3</span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-stone-900"><SlidersHorizontal size={16} /> Adjustment</p>
                    <p className="mt-1 text-stone-500">Correct stock when needed.</p>
                    <p className="mt-2 font-semibold text-stone-700">Optional</p>
                  </div>
                </Link>
                <Link to={movementPath} className="flex gap-3 border-t border-stone-100 px-5 py-4 hover:bg-stone-50 md:border-l xl:border-t-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">4</span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-stone-900"><Activity size={16} /> Movement</p>
                    <p className="mt-1 text-stone-500">Review the ledger.</p>
                    <p className="mt-2 font-semibold text-stone-700">Review</p>
                  </div>
                </Link>
                <div className="flex gap-3 border-t border-stone-100 px-5 py-4 xl:border-l xl:border-t-0">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${closingSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>5</span>
                  <div>
                    <p className="font-semibold text-stone-900">Closing Stock</p>
                    <p className="mt-1 text-stone-500">Count ending stock.</p>
                    <p className={closingSubmitted ? "mt-2 font-semibold text-emerald-700" : "mt-2 font-semibold text-amber-700"}>{closingSubmitted ? "Submitted" : "Not submitted"}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mt-7 max-w-7xl overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="font-semibold text-stone-950">Stock count tasks</h2>
              <p className="mt-1 text-sm text-stone-500">Opening and closing counts for this business day.</p>
            </div>
            {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {loading ? (
              <div className="p-6 text-sm text-stone-500">Loading stock counts...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-sm text-stone-500">No stock counts found for this date</div>
            ) : (
              orderedItems.filter((item) => item.count_type === "OPENING").map(renderCount)
            )}
            {!loading && orderedItems.filter((item) => item.count_type === "CLOSING").map(renderCount)}
          </section>

        </main>
      </section>
    </div>
  );
}
