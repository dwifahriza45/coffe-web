import { ArrowLeft, ClipboardCheck, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBusinessDays, type BusinessDay } from "../../api/businessDay.api";
import { getInventoryCounts, type InventoryCount } from "../../api/inventoryCount.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export default function InventoryCountPage() {
  const { businessDayID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<InventoryCount[]>([]);
  const [businessDay, setBusinessDay] = useState<BusinessDay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function loadCounts() {
      setLoading(true);
      setError("");
      try {
        const response = await getInventoryCounts({
          start: (page - 1) * pageSize,
          limit: pageSize,
          business_day_id: businessDayID,
          count_type: "",
          status: "",
          name: search,
        });
        if (!current) return;
        setItems(response.data ?? []);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setTotal(0);
        setError(response?.message || "Could not load inventory counts.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCounts();
    return () => {
      current = false;
    };
  }, [businessDayID, page, pageSize, search]);

  useEffect(() => {
    let current = true;
    async function loadBusinessDay() {
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header>
            <Link to="/business-days" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
              <ArrowLeft size={17} />
              Business Days
            </Link>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e8efe5] text-[#547144]">
              <ClipboardCheck size={22} />
            </div>
            <h1 className="font-serif text-3xl font-bold">Inventory Counts</h1>
            <p className="mt-2 text-sm text-stone-500">{businessDay?.business_date ?? businessDayID}</p>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Count documents</h2>
                <p className="text-xs text-stone-500">{total} counts found</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                <Search size={17} className="text-stone-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search count..." />
              </form>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Counted By</th>
                    <th className="px-5 py-3">Counted At</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">Loading inventory counts...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">No inventory counts found</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.inventory_count_id}>
                        <td className="px-5 py-4 text-sm font-semibold">{item.count_type}</td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">{item.counted_by_info?.fullname ?? item.counted_by}</td>
                        <td className="px-5 py-4 text-sm text-stone-600">{new Date(item.counted_at).toLocaleString("en-GB")}</td>
                        <td className="px-5 py-4 text-sm text-stone-600">{item.notes || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">Page {page} of {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  Limit
                  <select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10">
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
              </div>
            </footer>
          </section>
        </main>
      </section>
    </div>
  );
}
