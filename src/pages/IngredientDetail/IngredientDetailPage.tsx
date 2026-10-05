import { isAxiosError } from "axios";
import { ArrowLeft, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getIngredient,
  getIngredientPrices,
  setIngredientPriceActive,
  type Ingredient,
  type IngredientPriceOption,
} from "../../api/ingredient.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import {
  formatNumber,
} from "../../utils/numberFormat";
import { formatBusinessDate } from "../../utils/businessDate";

export default function IngredientDetailPage() {
  const { ingredientID = "" } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canUpdate = userCan(user, "ingredients", "update");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [prices, setPrices] = useState<IngredientPriceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    Promise.all([
      getIngredient(ingredientID),
      getIngredientPrices(ingredientID),
    ])
      .then(([item, list]) => {
        if (current) {
          setIngredient(item.data ?? null);
          setPrices(list.data ?? []);
        }
      })
      .catch(() => {
        if (current) {
          setIngredient(null);
          setPrices([]);
          setError(t("Could not load ingredient prices."));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [ingredientID, refresh]);
  const activePrice = prices.find((price) => price.active);
  async function run(action: () => Promise<void>) {
    if (saving) return;
    setConfirm(null);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setRefresh((value) => value + 1);
      setNotice(t("Ingredient price saved"));
    } catch (err) {
      const message = isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || t("Action failed."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link
            to="/ingredient-management"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600"
          >
            <ArrowLeft size={16} />
            {t("Back to ingredients")}
          </Link>
          <header className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">{t("Ingredient Detail")}</p>
              <h1 className="mt-1 font-serif text-3xl font-bold">
                {ingredient?.name || t("Ingredient")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Choose the active price for this ingredient")}
              </p>
            </div>
          </header>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700"
            >
              {notice}
            </p>
          )}
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">{t("Active price")}</p>
            <p className="mt-2 text-2xl font-bold text-[#362219]">
              {activePrice ? `Rp ${formatNumber(activePrice.price, 2)}` : "—"}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              {t(
                "Price per packaging unit. Used as the default for new supplier shopping records.",
              )}
            </p>
          </div>
          <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="border-b border-stone-200 p-5">
              <h2 className="font-bold">{t("Ingredient price history")}</h2>
              <p className="mt-1 text-xs text-stone-500">
                {t(
                  "Activating a price automatically deactivates the previous price. Saved shopping records keep their prices.",
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    {["Price", "Effective Date", "Notes", "Status"].map(
                      (label) => (
                        <th key={label} className="px-5 py-3">
                          {t(label)}
                        </th>
                      ),
                    )}
                    {canUpdate && (
                      <th className="px-5 py-3 text-right">{t("Action")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading || !prices.length ? (
                    <tr>
                      <td
                        colSpan={canUpdate ? 5 : 4}
                        className="p-10 text-center text-stone-500"
                      >
                        {t(loading ? "Loading..." : "No ingredient prices yet")}
                      </td>
                    </tr>
                  ) : (
                    prices.map((price) => (
                      <tr key={price.price_option_id}>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold">
                          Rp {formatNumber(price.price, 2)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {formatBusinessDate(price.effective_date)}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap break-words px-5 py-4">
                          {price.notes || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${price.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                          >
                            {t(price.active ? "Active" : "Inactive")}
                          </span>
                        </td>
                        {canUpdate && (
                          <td className="px-5 py-4 text-right">
                            <button
                              disabled={saving}
                              title={t(
                                price.active ? "Deactivate" : "Activate",
                              )}
                              onClick={() =>
                                setConfirm({
                                  title: t(
                                    price.active
                                      ? "Deactivate ingredient price"
                                      : "Activate ingredient price",
                                  ),
                                  message: t(
                                    price.active
                                      ? "Deactivate this price? No price will be selected."
                                      : "Use this price? The previous active price will become inactive.",
                                  ),
                                  action: async () => {
                                    await setIngredientPriceActive(
                                      ingredientID,
                                      price.price_option_id,
                                      !price.active,
                                    );
                                  },
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50 disabled:opacity-40"
                            >
                              <Power size={14} />
                              {t(price.active ? "Deactivate" : "Activate")}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </section>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmText={t("Confirm")}
        submitting={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void run(confirm.action);
        }}
      />
    </div>
  );
}
