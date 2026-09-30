import { formatBusinessDate } from "../../utils/businessDate";
import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { getBusinessDays } from "../../api/businessDay.api";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

export default function InventoryCountEntryPage({ type }: { type: "OPENING" | "CLOSING" }) {
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [result, setResult] = useState<{ key: string; path?: string; error?: boolean } | null>(null);
  const now = new Date();
  const date = params.get("date") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const businessDayID = params.get("businessDayID") || "";
  const key = `${type}:${businessDayID}:${date}`;

  useEffect(() => {
    let current = true;
    async function resolve() {
      try {
        let dayID = businessDayID;
        if (!dayID) {
          const days = await getBusinessDays({ start: 0, limit: 1, status: "", business_date: date });
          dayID = days.data?.[0]?.business_day_id || "";
        }
        if (!dayID) {
          if (current) setResult({ key });
          return;
        }
        const counts = await getInventoryCounts({ start: 0, limit: 1, business_day_id: dayID, count_type: type, status: "", name: "" });
        const count = counts.data?.[0];
        const query = new URLSearchParams({ businessDayID: dayID, date: count?.business_day_info?.business_date || date, focus: type.toLowerCase() });
        if (current) setResult({ key, path: count ? `/business-days/${dayID}/inventory-counts/${count.inventory_count_id}?${query}` : undefined });
      } catch {
        if (current) setResult({ key, error: true });
      }
    }
    void resolve();
    return () => { current = false; };
  }, [businessDayID, date, key, type]);

  const resolved = result?.key === key ? result : null;
  if (resolved?.path) return <Navigate to={resolved.path} replace />;
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={`/stock-count?${new URLSearchParams({ date, ...(businessDayID ? { businessDayID } : {}) })}`} className="mb-4 inline-block text-sm font-semibold text-stone-600">← {t("Stock Count")}</Link>
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h1 className="font-serif text-3xl font-bold">{t(type === "OPENING" ? "Opening Stock" : "Closing Stock")}</h1>
            <p className="mt-2 text-sm text-stone-500">{formatBusinessDate(date)}</p>
            <p role="status" className="mt-5 text-sm text-stone-600">{!resolved ? t("Loading...") : resolved.error ? t("Could not load inventory counts.") : t("No stock count available for this date. Open the business day first.")}</p>
          </section>
        </main>
      </section>
    </div>
  );
}
