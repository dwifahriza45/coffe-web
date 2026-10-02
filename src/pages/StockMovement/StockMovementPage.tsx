import { ArrowLeft, ArrowRightLeft, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getStockMovements, type StockMovement } from "../../api/stockMovement.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { getUserRoleNames } from "../../app/roleAccess";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate } from "../../utils/businessDate";
import { formatNumber } from "../../utils/numberFormat";

const movementLabels: Record<string, string> = {
  STOCK_IN: "Stock In",
  ORDER_USAGE: "Order Usage",
  WASTE: "Waste",
  ADJUSTMENT_IN: "Koreksi Stok (+)",
  ADJUSTMENT_OUT: "Koreksi Stok (-)",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID");
}

export default function StockMovementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const roles = getUserRoleNames(user);
  const todayOnly = roles.includes("inventory") && !roles.some((role) => ["admin", "leader"].includes(role));
  const [params] = useSearchParams();
  const queryBusinessDayID = params.get("businessDayID") ?? "";
  const queryDate = params.get("date") ?? "";
  const businessDayID = queryBusinessDayID;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [date, setDate] = useState(queryDate);
  const scopedDate = businessDayID ? "" : todayOnly ? currentBusinessDate() : date;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [items, setItems] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!businessDayID && !todayOnly) setDate(queryDate);
  }, [businessDayID, queryDate, todayOnly]);

  useEffect(() => { setPage(1); }, [businessDayID, scopedDate]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    getStockMovements({ start: (page - 1) * limit, limit, business_day_id: businessDayID, business_date: scopedDate, movement_type: type, name: search })
      .then((response) => { if (current) { setItems(response.data ?? []); setTotal(response.total ?? 0); } })
      .catch((error) => { if (current) { setItems([]); setTotal(0); setError(isAxiosError<{message?: string}>(error) ? error.response?.data.message || t("Could not load stock movements.") : t("Could not load stock movements.")); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [businessDayID, scopedDate, page, limit, type, search, refresh]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const displayDate = businessDayID ? ((items[0]?.business_date ?? queryDate) || businessDayID) : todayOnly ? currentBusinessDate() : t("Inventory quantity changes");
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={businessDayID ? `/business-days/${businessDayID}/inventory-counts` : todayOnly ? "/stock-count" : "/business-days"} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600"><ArrowLeft size={17} />{businessDayID || todayOnly ? t("Stock Count") : t("Business Days")}</Link>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[#efe9df] text-[#8a5a3f]"><ArrowRightLeft size={22} /></div>
              <h1 className="font-serif text-3xl font-bold">{t("Stock Movement")}</h1>
              <p className="mt-2 text-sm text-stone-500">{displayDate}</p>
              <p className="mt-1 text-xs text-stone-500">{t("Stock movement history from submitted stock activity.")}</p>
            </div>
            <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">{t("Refresh")}</button>
          </header>
          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
              <p className="text-sm text-stone-500">{total} {t("movements")}</p>
              <div className="flex flex-wrap gap-2">
                {!todayOnly && !businessDayID && <input aria-label={t("Business date")} type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />}
                <select aria-label={t("Movement type")} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="rounded-lg border border-stone-300 px-3 py-2 text-sm"><option value="">{t("All types")}</option>{Object.entries(movementLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select>
                <form onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2"><Search size={16} className="text-stone-400" /><input aria-label={t("Search movements")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t("Ingredient or reference...")} className="min-w-0 bg-transparent text-sm outline-none" /></form>
              </div>
            </div>
            {error && <div role="alert" className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Date / Time", "Ingredient", "Movement", "Quantity", "Reference", "Submitted by", "Notes"].map((label) => <th key={label} className="px-5 py-3">{t(label)}</th>)}</tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? <tr><td colSpan={7} className="p-12 text-center text-stone-500">{t("Loading movements...")}</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-stone-500">{t("No stock movement history found.")}</td></tr> : items.map((item) => {
                    const outgoing = ["ORDER_USAGE", "WASTE", "ADJUSTMENT_OUT"].includes(item.movement_type);
                    return <tr key={item.stock_movement_id}>
                      <td className="px-5 py-4"><p>{item.business_date}</p><p className="mt-1 text-xs text-stone-500">{formatDateTime(item.created_at)}</p></td>
                      <td className="px-5 py-4 font-semibold">{item.ingredient_name}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">{t(movementLabels[item.movement_type] ?? item.movement_type)}</span></td>
                      <td className={`whitespace-nowrap px-5 py-4 font-semibold ${outgoing ? "text-red-600" : "text-emerald-700"}`}>{outgoing ? "−" : "+"}{formatNumber(item.quantity, 3)} <span className="font-normal text-stone-500">{item.unit_code}</span></td>
                      <td className="px-5 py-4">{item.reference_type === "STOCK_RECEIPT" ? <Link className="font-semibold text-[#92502f] underline" to={`/stock-in/${item.reference_id}?${new URLSearchParams({businessDayID: item.business_day_id, date: item.business_date})}`}>{item.reference_id}</Link> : item.reference_type === "STOCK_ADJUSTMENT" ? <Link className="font-semibold text-[#92502f] underline" to={`/stock-adjustments/${item.reference_id}?${new URLSearchParams({businessDayID: item.business_day_id, date: item.business_date})}`}>{item.reference_id}</Link> : item.reference_id}<p className="mt-1 text-xs text-stone-400">{item.stock_movement_id}</p></td>
                      <td className="px-5 py-4">{item.created_by_name}</td>
                      <td className="max-w-xs whitespace-pre-wrap break-words px-5 py-4 text-stone-500">{item.notes || "-"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 p-4 text-xs text-stone-500">
              <div className="flex items-center gap-3"><span>{t("Page")} {page} {t("of")} {pages}</span><label>{t("Limit")} <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="rounded border px-2 py-1">{[10,20,30,40,50].map((size) => <option key={size}>{size}</option>)}</select></label></div>
              <div className="flex gap-2"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">{t("Previous")}</button><button disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">{t("Next")}</button></div>
            </footer>
          </section>
        </main>
      </section>
    </div>
  );
}
