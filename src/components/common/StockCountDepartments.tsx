import { useAuth } from "../../app/AuthContext";
import { userCanStockDepartment } from "../../app/roleAccess";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/LanguageContext";
import { stockCountDepartments } from "../../utils/stockCountDepartment";

export default function StockCountDepartments({ statuses = {} }: { statuses?: Record<string, string> }) {
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const { user } = useAuth();
  const allowedDepartments = stockCountDepartments.filter((d) => userCanStockDepartment(user, d.key));
  const active = params.get("department") || "";
  function select(key: string) {
    const next = new URLSearchParams(params);
    if (key) next.set("department", key); else next.delete("department");
    setParams(next);
  }
  return <div className="my-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-stone-700">{t("Stock count section")}</p>
      <button type="button" onClick={() => select("")} aria-pressed={!active} className="text-xs font-semibold text-[var(--color-brand-accent)] underline">{allowedDepartments.length === 3 ? t("All sections") : "Semua bagian yang diizinkan"}</button>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      {allowedDepartments.map((department) => <button key={department.key} type="button" aria-pressed={active === department.key} onClick={() => select(department.key)} className={`rounded-xl border p-4 text-left transition ${active === department.key ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-soft)]" : "border-stone-200 bg-white hover:bg-stone-50"}`}>
        <span className="block text-sm font-bold text-stone-900">{department.label}</span>
        <span className="mt-1 block text-xs text-stone-500">{department.category}</span>
        {statuses[department.key] && <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${statuses[department.key] === "SUBMITTED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{t(statuses[department.key] === "SUBMITTED" ? "Completed" : "Draft")}</span>}
      </button>)}
    </div>
  </div>;
}
