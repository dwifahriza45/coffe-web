import { ArrowLeft, ClipboardCheck, PackagePlus } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import { getInventoryCounts, type InventoryCount } from "../../api/inventoryCount.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

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
        setBusinessDay(null);
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

  function renderCount(item: InventoryCount) {
    return (
                <Link key={item.inventory_count_id} to={businessDayID ? `/business-days/${businessDayID}/inventory-counts/${item.inventory_count_id}` : `/stock-count/${item.inventory_count_id}`} className="group grid gap-4 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:bg-stone-50/60 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold transition-colors group-hover:text-[#92502f]">{countTitle(item.count_type)}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{countDescription(item.count_type)}</p>
                    {!businessDayID && <p className="mt-1 text-xs font-semibold text-stone-400">{item.business_day_info?.business_date ?? item.business_day_id}</p>}
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[92px_minmax(0,1fr)_96px_minmax(0,1fr)]">
                      <dt className="text-stone-500">Counted by</dt>
                      <dd className="font-medium text-stone-800">{item.counted_by_info?.fullname ?? item.counted_by ?? "-"}</dd>
                      <dt className="text-stone-500">Submitted</dt>
                      <dd className="font-medium text-stone-800">{formatDateTime(item.counted_at)}</dd>
                    </dl>
                  </div>
                  <span className="inline-flex w-fit items-center justify-center rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition group-hover:border-[#92502f] group-hover:text-[#92502f]">
                    {item.status === "SUBMITTED" ? "View" : "Open"}
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

          <section className="mt-7 max-w-5xl space-y-3">
            {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {loading ? (
              <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading stock counts...</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">No stock counts found for this date</div>
            ) : (
              orderedItems.filter((item) => item.count_type === "OPENING").map(renderCount)
            )}
            {businessDayID && businessDay && (
              <Link to={`/stock-in?businessDayID=${encodeURIComponent(businessDayID)}&date=${businessDay.business_date}`} className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:bg-stone-50/60">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold"><PackagePlus size={19} /> Stock In</h2>
                  <p className="mt-1 text-sm text-stone-500">Incoming stock for this business day</p>
                </div>
                <span className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">Open</span>
              </Link>
            )}
            <Link to={businessDayID ? `/stock-movements?businessDayID=${encodeURIComponent(businessDayID)}` : "/stock-movements"} className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 hover:bg-stone-50">
              <div><h2 className="text-base font-semibold">Stock Movement</h2><p className="mt-1 text-sm text-stone-500">Quantity ledger for this business day</p></div>
              <span className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">View</span>
            </Link>
            {!loading && orderedItems.filter((item) => item.count_type === "CLOSING").map(renderCount)}
          </section>
        </main>
      </section>
    </div>
  );
}
