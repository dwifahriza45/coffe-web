import { getDraftStockReceiptCount } from "../../api/stockReceipt.api";
import { CalendarDays, CheckCircle2, ClipboardCheck, Lock, Plus, Search, Trash2 } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import {
  closeBusinessDay,
  deleteBusinessDay,
  getBusinessDays,
  openBusinessDay,
  type BusinessDay,
} from "../../api/businessDay.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import TableActionButton from "../../components/common/TableActionButton";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage, type Language } from "../../app/LanguageContext";
import { getUserRoleNames, userCan } from "../../app/roleAccess";
import { getInventoryCounts } from "../../api/inventoryCount.api";
import { getDraftStockAdjustmentCount } from "../../api/stockAdjustment.api";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | undefined, language: Language) {
  return value ? new Date(value).toLocaleString(language === "id" ? "id-ID" : "en-GB") : "-";
}

export default function BusinessDayPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const roles = getUserRoleNames(user);
  const isTodayActionOnly = !roles.includes("admin") && roles.includes("leader");
  const canCreateBusinessDay = userCan(user, "business_days", "create");
  const canUpdateBusinessDay = userCan(user, "business_days", "update");
  const canDeleteBusinessDay = userCan(user, "business_days", "delete");
  const canReadInventoryCounts = userCan(user, "inventory_counts", "read");
  const showActions = canUpdateBusinessDay || canDeleteBusinessDay || canReadInventoryCounts;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<BusinessDay[]>([]);
  const [draftStockInCounts, setDraftStockInCounts] = useState<Record<string, number>>({});
  const [draftStockAdjustmentCounts, setDraftStockAdjustmentCounts] = useState<Record<string, number>>({});
  const [closingSubmitted, setClosingSubmitted] = useState<Record<string, boolean>>({});
  const [stockCountExists, setStockCountExists] = useState<Record<string, boolean>>({});
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
        const nextItems = response.data ?? [];
        setItems(nextItems);
        setTotal(response.total ?? 0);
        const statusEntries = await Promise.all(
          nextItems.map(async (item) => {
            const counts = await getInventoryCounts({
              start: 0,
              limit: 10,
              business_day_id: item.business_day_id,
              count_type: "",
              status: "",
              name: "",
            });
            const pendingStockIn = item.status === "OPEN" ? await getDraftStockReceiptCount(item.business_day_id) : 0;
            const pendingAdjustment = item.status === "OPEN" ? await getDraftStockAdjustmentCount(item.business_day_id) : 0;
            return [item.business_day_id, counts.data?.some((count) => count.count_type === "CLOSING" && count.status === "SUBMITTED") ?? false, pendingStockIn, pendingAdjustment, Boolean(counts.data?.length)] as const;
          }),
        );
        if (!current) return;
        setClosingSubmitted(Object.fromEntries(statusEntries.map(([id, submitted]) => [id, submitted])));
        setDraftStockInCounts(Object.fromEntries(statusEntries.map(([id, , pending]) => [id, pending])));
        setDraftStockAdjustmentCounts(Object.fromEntries(statusEntries.map(([id, , , pending]) => [id, pending])));
        setStockCountExists(Object.fromEntries(statusEntries.map(([id, , , , exists]) => [id, exists])));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setClosingSubmitted({});
        setStockCountExists({});
        setDraftStockAdjustmentCounts({});
        setTotal(0);
        setError(response?.message || t("Could not load business days."));
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
      title: t("Open business day"),
      message: `${t("Open business day for")} ${businessDate}?`,
      confirmText: t("Open day"),
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
          setError(response?.message || t("Could not open business day."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestClose(item: BusinessDay) {
    setConfirm({
      title: t("Close business day"),
      message: `${t("Close business day for")} ${item.business_date}?`,
      confirmText: t("Close day"),
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
          setError(response?.message || t("Could not close business day."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: BusinessDay) {
    setConfirm({
      title: t("Delete business day"),
      message: `${t("Delete business day for")} ${item.business_date}? ${t("This is only allowed when it has no operational records.")}`,
      confirmText: t("Delete day"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteBusinessDay(item.business_day_id);
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not delete business day."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedBusinessDay = items.find((item) => item.business_date === businessDate);
  const canOpenBusinessDay = canCreateBusinessDay && Boolean(businessDate) && !selectedBusinessDay && !submitting;

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
              <h1 className="font-serif text-3xl font-bold">{t("Business Days")}</h1>
              <p className="mt-2 text-sm text-stone-500">{t("Track operational dates for daily, monthly, and yearly reports.")}</p>
            </div>
            {canCreateBusinessDay && (
              <form onSubmit={submitOpen} className="flex flex-col gap-2 sm:flex-row">
                <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10 disabled:bg-stone-100" disabled={submitting || isTodayActionOnly} />
                <button type="submit" disabled={!canOpenBusinessDay} title={selectedBusinessDay ? t("Business day already exists") : t("Open business day")} className="flex items-center justify-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  <Plus size={17} />
                  {t("Open business day")}
                </button>
              </form>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t("Operational Days")}</h2>
                <p className="text-xs text-stone-500">{total} {t("business days found")}</p>
              </div>
              <label className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10">
                <Search size={17} className="text-stone-400" />
                <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none">
                  <option value="">{t("All status")}</option>
                  <option value="OPEN">{t("Open")}</option>
                  <option value="CLOSED">{t("Closed")}</option>
                </select>
              </label>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Date")}</th>
                    <th className="px-5 py-3">{t("Opened By")}</th>
                    <th className="px-5 py-3">{t("Opened At")}</th>
                    <th className="px-5 py-3">{t("Closed By")}</th>
                    <th className="px-5 py-3">{t("Closed At")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={showActions ? 7 : 6} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading business days...")}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={showActions ? 7 : 6} className="px-5 py-14 text-center text-sm text-stone-500">{t("No business days found")}</td></tr>
                  ) : (
                    items.map((item) => {
                      const pendingStockIn = draftStockInCounts[item.business_day_id] ?? 0;
                      const pendingAdjustment = draftStockAdjustmentCounts[item.business_day_id] ?? 0;
                      const hasStockCount = stockCountExists[item.business_day_id] ?? false;
                      const canClose = item.status === "OPEN" && closingSubmitted[item.business_day_id] && pendingStockIn === 0 && pendingAdjustment === 0 && (!isTodayActionOnly || item.business_date === today());
                      const canDelete = !submitting && !hasStockCount;
                      const closeTitle = pendingStockIn > 0
                        ? t("Submit all draft Stock In first")
                        : pendingAdjustment > 0
                          ? t("Submit all draft Stock Adjustment first")
                          : closingSubmitted[item.business_day_id]
                            ? t("Close business day")
                            : t("Submit closing stock first");
                      return (
                      <tr key={item.business_day_id}>
                        <td className="px-5 py-4 text-sm">{item.business_date}</td>
                        <td className="px-5 py-4 text-sm font-semibold">{item.opened_by_info?.fullname ?? item.opened_by}</td>
                        <td className="px-5 py-4 text-sm text-stone-600">{formatDateTime(item.opened_at, language)}</td>
                        <td className="px-5 py-4 text-sm">{item.closed_by_info?.fullname ?? (item.closed_by ? item.closed_by : "-")}</td>
                        <td className="px-5 py-4 text-sm text-stone-600">{formatDateTime(item.closed_at, language)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "OPEN" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {item.status === "OPEN" ? <CheckCircle2 size={13} /> : <Lock size={13} />}
                            {item.status === "OPEN" ? t("Open") : t("Closed")}
                          </span>
                        </td>
                        {showActions && (
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {canReadInventoryCounts && (
                                <TableActionButton to={`/business-days/${item.business_day_id}/inventory-counts`} label={t("Stock Count")} variant="info">
                                  <ClipboardCheck size={16} />
                                </TableActionButton>
                              )}
                              {canUpdateBusinessDay && (
                                <TableActionButton onClick={() => requestClose(item)} disabled={!canClose || submitting} label={closeTitle}>
                                  <Lock size={14} />
                                </TableActionButton>
                              )}
                              {canDeleteBusinessDay && (
                                <TableActionButton onClick={() => requestDelete(item)} disabled={!canDelete} label={hasStockCount ? t("Delete stock count first") : t("Delete business day")} variant="danger">
                                  <Trash2 size={14} />
                                </TableActionButton>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">{t("Page")} {page} {t("of")} {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Limit")}
                  <select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10">
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Previous")}</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Next")}</button>
              </div>
            </footer>
          </section>
        </main>
      </section>

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? t("Confirm")} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
