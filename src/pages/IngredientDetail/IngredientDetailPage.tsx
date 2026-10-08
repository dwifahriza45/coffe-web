import UsageBadge from "../../components/common/UsageBadge";
import TableActionButton from "../../components/common/TableActionButton";
import ManagementTable from "../../components/common/ManagementTable";
import { isAxiosError } from "axios";
import { ArrowLeft, Pencil, Power, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createIngredientPrice,
  updateIngredientPrice,
  deleteIngredientPrice,
  type IngredientPricePayload,
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
import { formatNumber, formatNumberInput, normalizeNumberInput } from "../../utils/numberFormat";
import {
  currentBusinessDate,
  formatBusinessDate,
} from "../../utils/businessDate";

export default function IngredientDetailPage() {
  const { ingredientID = "" } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreate = userCan(user, "ingredients", "create");
  const canDelete = userCan(user, "ingredients", "delete");
  const canManage = userCan(user, "ingredients", "update") || canDelete;
  const canUpdate = userCan(user, "ingredients", "update");
  const [editor, setEditor] = useState<{
    id: string;
    data: IngredientPricePayload;
  } | null>(null);
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
    Promise.allSettled([
      getIngredient(ingredientID),
      getIngredientPrices(ingredientID),
    ])
      .then(([item, list]) => {
        if (!current) return;
        setIngredient(
          item.status === "fulfilled" ? (item.value.data ?? null) : null,
        );
        setPrices(list.status === "fulfilled" ? (list.value.data ?? []) : []);
        if (item.status === "rejected" || list.status === "rejected") {
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
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
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
            {canCreate && (
              <button
                disabled={saving || loading || !ingredient}
                onClick={() => {
                  setError("");
                  setNotice("");
                  setEditor({
                    id: "",
                    data: {
                      price: "",
                      effective_date: currentBusinessDate(),
                      notes: "",
                      active: false,
                    },
                  });
                }}
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t("Add ingredient price")}
              </button>
            )}
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
          {editor && (
            <form
              className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  !(editor.data.price_basis === "unit" ? /^[0-9]{1,16}(\.[0-9]{1,6})?$/ : /^[0-9]{1,16}(\.[0-9]{1,2})?$/).test(editor.data.price) ||
                  !editor.data.effective_date
                ) {
                  setError(t("Enter a valid price and date"));
                  return;
                }
                void run(async () => {
                  if (editor.id)
                    await updateIngredientPrice(
                      ingredientID,
                      editor.id,
                      editor.data,
                    );
                  else await createIngredientPrice(ingredientID, editor.data);
                  setEditor(null);
                });
              }}
            >
              <h2 className="font-bold">
                {t(
                  editor.id
                    ? "Update ingredient price"
                    : "Add ingredient price",
                )}
              </h2>
              <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  Dasar harga
                  <select value={editor.data.price_basis || "package"}
                    onChange={(event) => setEditor({ ...editor, data: { ...editor.data, price: "", price_basis: event.target.value as "package" | "unit" } })}
                    className="mt-1 block w-full rounded-lg border border-stone-300 p-2">
                    <option value="package">Harga per kemasan</option>
                    <option value="unit">Harga per satuan isi ({prices.find((p) => p.price_option_id === editor.id)?.price_content_unit || activePrice?.price_content_unit || "satuan isi item"})</option>
                  </select>
                  <p className="mt-2 text-xs text-stone-500">Untuk Ice Rp1 per GR, pilih harga per satuan isi lalu masukkan 1. Harga kemasan dihitung dari jumlah isi item.</p>
                </label>
                <label className="text-sm">
                  {editor.data.price_basis === "unit" ? "Harga satuan" : "Harga kemasan"} (Rp)
                  <input
                    autoFocus
                    required
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(editor.data.price)}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        data: { ...editor.data, price: normalizeNumberInput(e.target.value) },
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-stone-300 p-2"
                  />
                </label>
                <label className="text-sm">
                  {t("Effective Date")}
                  <input
                    required
                    type="date"
                    value={editor.data.effective_date}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        data: {
                          ...editor.data,
                          effective_date: e.target.value,
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-stone-300 p-2"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  {t("Notes")}
                  <textarea
                    maxLength={1000}
                    value={editor.data.notes}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        data: { ...editor.data, notes: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-stone-300 p-2"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={editor.data.active}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        data: { ...editor.data, active: e.target.checked },
                      })
                    }
                  />
                  {t("Use as active price")}
                </label>
              </fieldset>
              <p className="text-xs text-stone-500">
                {t(
                  "Activating a price automatically deactivates the previous price. Saved shopping records keep their prices.",
                )}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditor(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {t("Cancel")}
                </button>
                <button
                  disabled={saving}
                  className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t(saving ? "Saving..." : "Save")}
                </button>
              </div>
            </form>
          )}
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">{t("Active price")}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-brand-primary)]">
              {activePrice ? `Rp ${formatNumber(activePrice.price, 2)}` : "—"}
            </p>
            {activePrice && <p className="mt-2 font-semibold">Rp {formatNumber(activePrice.unit_price, 6)} / {activePrice.price_content_unit}</p>}
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
            <ManagementTable
              label={t("Ingredient price history")}
              headers={
                <>
                  {["Price", "Unit Price", "Effective Date", "Notes", "Usage", "Status"].map(
                    (label) => (
                      <th key={label} className="px-5 py-3">
                        {t(label)}
                      </th>
                    ),
                  )}
                  {canManage && (
                    <th className="px-5 py-3 text-right">{t("Action")}</th>
                  )}
                </>
              }
            >
              {loading || !prices.length ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-5 py-14 text-center text-sm text-stone-500"
                  >
                    {t(
                      loading
                        ? "Loading..."
                        : error
                          ? "Could not load ingredient prices."
                          : "No ingredient prices yet",
                    )}
                  </td>
                </tr>
              ) : (
                prices.map((price) => (
                  <tr
                    key={price.price_option_id}
                    className="hover:bg-stone-50/70"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold">
                      Rp {formatNumber(price.price, 2)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold">
                      Rp {formatNumber(price.unit_price, 6)}
                      {price.price_content_unit && (
                        <span className="ml-1 text-xs font-normal text-stone-500">/ {price.price_content_unit}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {formatBusinessDate(price.effective_date)}
                    </td>
                    <td className="max-w-sm whitespace-pre-wrap break-words px-5 py-4">
                      {price.notes || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <UsageBadge inUse={price.in_use} />
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${price.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                      >
                        {t(price.active ? "Active" : "Inactive")}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          {canUpdate && (
                            <TableActionButton
                              disabled={saving || !!editor}
                              onClick={() => {
                                setError("");
                                setNotice("");
                                setEditor({
                                  id: price.price_option_id,
                                  data: {
                                    price: price.price,
                                    effective_date: price.effective_date,
                                    notes: price.notes,
                                    active: price.active,
                                  },
                                });
                              }}
                              label={t("Update ingredient price")}
                            >
                              <Pencil size={15} />
                            </TableActionButton>
                          )}
                          {canDelete && (
                            <TableActionButton
                              disabled={saving || !!editor || price.in_use}
                              onClick={() =>
                                setConfirm({
                                  title: t("Delete ingredient price"),
                                  message: t(
                                    "Delete this unused price? Deleting an active price leaves no active price.",
                                  ),
                                  action: async () => {
                                    await deleteIngredientPrice(
                                      ingredientID,
                                      price.price_option_id,
                                    );
                                  },
                                })
                              }
                              label={t(
                                price.in_use
                                  ? "Price already used in PO"
                                  : "Delete ingredient price",
                              )}
                              variant="danger"
                            >
                              <Trash2 size={15} />
                            </TableActionButton>
                          )}
                          {canUpdate && (
                            <TableActionButton
                              disabled={saving || !!editor}
                              label={t(
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
                            >
                              <Power size={14} />
                            </TableActionButton>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </ManagementTable>
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
