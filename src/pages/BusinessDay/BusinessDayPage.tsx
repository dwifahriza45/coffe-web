import { CalendarDays, CheckCircle2, ClipboardCheck, Lock, Plus, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  closeBusinessDay,
  getBusinessDays,
  openBusinessDay,
  type BusinessDay,
} from "../../api/businessDay.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BusinessDayPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const isTodayActionOnly = !roles.includes("admin") && roles.includes("leader");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<BusinessDay[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businessDate, setBusinessDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    tone?: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    let current = true;
    async function loadBusinessDays() {
      setLoading(true);
      setError("");
      try {
        const response = await getBusinessDays({
          start: (page - 1) * pageSize,
          limit: pageSize,
          status,
          business_date: "",
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
        setError(response?.message || "Could not load business days.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadBusinessDays();
    return () => {
      current = false;
    };
  }, [page, pageSize, status, refreshKey]);

  useEffect(() => {
    if (isTodayActionOnly) setBusinessDate(today());
  }, [isTodayActionOnly]);

  function submitOpen(event: FormEvent) {
    event.preventDefault();
    setConfirm({
      title: "Open business day",
      message: `Open business day for ${businessDate}?`,
      confirmText: "Open day",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await openBusinessDay({ business_date: businessDate });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not open business day.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestClose(item: BusinessDay) {
    setConfirm({
      title: "Close business day",
      message: `Close ${item.business_day_id}?`,
      confirmText: "Close day",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await closeBusinessDay(item.business_day_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not close business day.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestReopen(item: BusinessDay) {
    setConfirm({
      title: "Reopen business day",
      message: `Reopen ${item.business_day_id}?`,
      confirmText: "Reopen day",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await openBusinessDay({ business_date: item.business_date });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not reopen business day.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e7edf0] text-[#4f6c78]">
                <CalendarDays size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">Business Days</h1>
              <p className="mt-2 text-sm text-stone-500">Track operational dates for daily, monthly, and yearly reports.</p>
            </div>
            <form onSubmit={submitOpen} className="flex flex-col gap-2 sm:flex-row">
              <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10 disabled:bg-stone-100" disabled={submitting || isTodayActionOnly} />
              <button type="submit" disabled={submitting || !businessDate} className="flex items-center justify-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                <Plus size={17} />
                Open business day
              </button>
            </form>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Operational Days</h2>
                <p className="text-xs text-stone-500">{total} business days found</p>
              </div>
              <label className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                <Search size={17} className="text-stone-400" />
                <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none">
                  <option value="">All status</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </label>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Opened By</th>
                    <th className="px-5 py-3">Closed By</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">Loading business days...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">No business days found</td></tr>
                  ) : (
                    items.map((item) => {
                      const canReopen = item.status === "CLOSED" && item.business_date === today();
                      const canClose = item.status === "OPEN" && (!isTodayActionOnly || item.business_date === today());
                      return (
                      <tr key={item.business_day_id}>
                        <td className="px-5 py-4 text-sm">{item.business_date}</td>
                        <td className="px-5 py-4 text-sm font-semibold">{item.opened_by_info?.fullname ?? item.opened_by}</td>
                        <td className="px-5 py-4 text-sm">{item.closed_by_info?.fullname ?? (item.closed_by ? item.closed_by : "-")}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "OPEN" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {item.status === "OPEN" ? <CheckCircle2 size={13} /> : <Lock size={13} />}
                            {item.status === "OPEN" ? "Open" : "Closed"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Link to={`/business-days/${item.business_day_id}/inventory-counts`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">
                              <ClipboardCheck size={14} />
                              Counts
                            </Link>
                            <button type="button" onClick={() => canReopen ? requestReopen(item) : requestClose(item)} disabled={!canReopen && !canClose} className="rounded-lg border px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent">
                              {canReopen ? "Reopen" : "Close"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
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

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
