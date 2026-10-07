import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  saveSupplierShopping,
  type SupplierCatalogItem,
  type Supplier,
  type SupplierTransaction,
  type SupplierShoppingPayload,
} from "../../api/supplier.api";
import {
  formatNumberInput,
} from "../../utils/numberFormat";
import { useLanguage } from "../../app/LanguageContext";

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

type Props = {
  supplierID: string;
  supplier: Supplier | null;
  catalog: SupplierCatalogItem[];
  editing?: SupplierTransaction;
  onClose: () => void;
  onSaved: () => void;
};
export default function SupplierShoppingForm({
  supplierID,
  supplier,
  catalog,
  editing,
  onClose,
  onSaved,
}: Props) {
  const { t } = useLanguage();
  const availableCatalog = [
    ...catalog,
    ...(editing?.items
      .filter(
        (item) =>
          !catalog.some((entry) => entry.ingredient_id === item.ingredient_id),
      )
      .map((item) => ({
        ingredient_id: item.ingredient_id,
        name: item.name,
        brand: item.brand,
        packaging: item.unit,
        content_qty: item.content_qty,
        content_unit: item.content_unit,
        price: item.unit_price,
        effective_date: null,
        active: true,
      })) || []),
  ];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<SupplierShoppingPayload>(() => ({
    purchase_no: editing?.number || "",
    purchase_date: editing?.date || today(),
    delivery_date: editing?.delivery_date || "",
    payment_method: editing?.payment_method || "",
    bank_account: editing?.bank_account || "",
    ship_to: editing?.ship_to || "",
    recipient: editing?.recipient || "",
    shipping_address: editing?.shipping_address || "",
    shipping_phone: editing?.shipping_phone || "",
    notes: editing?.notes || "",
    items: availableCatalog
      .filter(
        (item) =>
          item.active ||
          editing?.items.some(
            (row) => row.ingredient_id === item.ingredient_id,
          ),
      )
      .map((item) => {
        const previous = editing?.items.find(
          (row) => row.ingredient_id === item.ingredient_id,
        );
        return {
          ingredient_id: item.ingredient_id,
          description: previous?.brand ?? item.brand,
          quantity: previous?.quantity
            ? previous.quantity.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1")
            : "0",
          unit_price: previous?.unit_price ?? item.price ?? "",
        };
      }),
  }));
  const total = form.items.reduce(
    (sum, item) =>
      sum +
      Math.round(
        Number(item.quantity || 0) * Number(item.unit_price || 0) * 100,
      ) /
        100,
    0,
  );
  const selected = form.items.filter((item) => Number(item.quantity) > 0);
  function setItem(
    index: number,
    field: "quantity",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!selected.length) {
      setError(t("Enter a quantity for at least one item"));
      return;
    }
    if (
      form.items.some(
        (item) =>
          item.quantity !== "" && !/^\d{1,12}(\.\d{1,4})?$/.test(item.quantity),
      )
    ) {
      setError(t("Invalid quantity or price"));
      return;
    }
    if (
      selected.some((item) => item.unit_price === "")
    ) {
      setError(t("Ingredient has no active price. Select an active price in ingredient details first."));
      return;
    }
    if (form.delivery_date && form.delivery_date < form.purchase_date) {
      setError(t("Delivery date cannot precede purchase date"));
      return;
    }
    setSaving(true);
    try {
      await saveSupplierShopping(
        supplierID,
        { ...form, items: selected },
        editing?.transaction_id,
      );
      onSaved();
    } catch (err) {
      const message = isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      setError(
        message === "ingredient has no active price"
          ? t("Ingredient has no active price. Select an active price in ingredient details first.")
          : message === "purchase number already exists for this supplier"
          ? t("Purchase number already exists for this supplier")
          : message === "invalid supplier shopping record"
            ? t("Check shopping dates, items, quantities and prices")
            : t("Could not save shopping record"),
      );
    } finally {
      setSaving(false);
    }
  }
  const fields = [
    ["purchase_no", "Purchase number", "text"],
    ["purchase_date", "Purchase Date", "date"],
    ["delivery_date", "Delivery date", "date"],
    ["payment_method", "Payment method", "text"],
    ["bank_account", "Supplier bank account", "text"],
    ["ship_to", "Ship to", "text"],
    ["recipient", "Recipient", "text"],
    ["shipping_address", "Shipping address", "text"],
    ["shipping_phone", "Shipping phone", "tel"],
  ] as const;
  const renderField = ([field, label, type]: (typeof fields)[number]) => (
    <label key={field} className="text-sm font-semibold text-stone-700">
      {t(label)}
      {field === "purchase_date" ? " *" : ""}
      <input
        type={type}
        disabled={field === "purchase_no"}
        placeholder={field === "purchase_no" ? "PO-YYYYMMDD-XXXXXX" : undefined}
        required={field === "purchase_date"}
        min={field === "delivery_date" ? form.purchase_date : undefined}
        maxLength={
          field === "shipping_address"
            ? 2000
            : field === "shipping_phone"
              ? 30
              : field === "purchase_no"
                ? 100
                : 120
        }
        value={form[field]}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            [field]: event.target.value,
          }))
        }
        className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)] disabled:bg-stone-100 disabled:text-stone-500"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-stone-200 p-5">
          <h2 className="text-lg font-bold">
            {t(editing ? "Edit shopping record" : "Record supplier shopping")}
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-stone-100"
          >
            <X size={18} />
          </button>
        </header>
        <div className="space-y-5 overflow-auto p-5">
          <fieldset disabled={saving} className="space-y-6">
            <section className="border-b border-stone-200 pb-6">
              <h3 className="mb-4 text-sm font-bold uppercase text-[var(--color-brand-primary)]">
                {t("Purchase order")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[fields[0], fields[3], fields[1], fields[2]].map(renderField)}
              </div>
            </section>
            <div className="grid gap-6 sm:grid-cols-2">
              <section className="rounded-xl border border-stone-200 p-4">
                <h3 className="mb-4 text-sm font-bold uppercase text-[var(--color-brand-primary)]">
                  {t("Supplier information")}
                </h3>
                <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="font-semibold text-stone-700">{t("Name")}</dt>
                  <dd>{supplier?.name || "—"}</dd>
                  <dt className="font-semibold text-stone-700">
                    {t("Address")}
                  </dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {supplier?.address || "—"}
                  </dd>
                  <dt className="font-semibold text-stone-700">{t("Phone")}</dt>
                  <dd>{supplier?.phone || "—"}</dd>
                  <dt className="font-semibold text-stone-700">{t("Link")}</dt>
                  <dd>
                    {supplier?.link && /^https?:\/\//i.test(supplier.link) ? (
                      <a href={supplier.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50">
                        <ExternalLink size={14} />
                        {t("Open link")}
                      </a>
                    ) : "—"}
                  </dd>
                </dl>
                {renderField(fields[4])}
              </section>
              <section className="rounded-xl border border-stone-200 p-4">
                <h3 className="mb-4 text-sm font-bold uppercase text-[var(--color-brand-primary)]">
                  {t("Shipping information")}
                </h3>
                <div className="grid gap-3">
                  {fields.slice(5).map(renderField)}
                </div>
              </section>
            </div>
          </fieldset>
          <p className="text-sm text-stone-500">
            {t("Enter purchased quantities; zero-quantity items are excluded")}
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-220 text-left text-sm">
              <thead className="bg-[var(--color-brand-accent)] text-xs text-white">
                <tr>
                  {[
                    "Ingredient",
                    "Product description",
                    "Qty",
                    "Packaging unit",
                    "Price",
                    "Content Qty",
                    "Content unit",
                    "Total",
                  ].map((label) => (
                    <th key={label} className="px-3 py-3">
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {form.items.map((item, index) => {
                  const master = availableCatalog.find(
                    (entry) => entry.ingredient_id === item.ingredient_id,
                  );
                  const snapshot = editing?.items.find(
                    (entry) => entry.ingredient_id === item.ingredient_id,
                  );
                  return (
                    <tr
                      key={item.ingredient_id}
                      className={
                        Number(item.quantity) > 0 ? "bg-amber-50/50" : ""
                      }
                    >
                      <td className="px-3 py-3 font-medium">
                        {snapshot?.name || master?.name}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`${t("Product description")} ${master?.name}`}
                          value={item.description}
                          maxLength={1000}
                          disabled={saving}
                          readOnly
                          className="w-40 rounded border border-stone-300 px-2 py-2"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`${t("Qty")} ${master?.name}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.quantity}
                          disabled={saving}
                          onChange={(e) =>
                            setItem(index, "quantity", e.target.value)
                          }
                          className="w-24 rounded border border-stone-300 px-2 py-2"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {snapshot?.unit || master?.packaging || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`${t("Price")} ${master?.name}`}
                          title={t("Price follows the active ingredient price")}
                          type="text"
                          inputMode="decimal"
                          value={formatNumberInput(item.unit_price)}
                          placeholder="—"
                          disabled={saving}
                          readOnly
                          tabIndex={-1}
                          className="w-32 rounded border border-stone-200 bg-stone-100 px-2 py-2 text-stone-600"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {Number(
                          snapshot?.content_qty || master?.content_qty || 0,
                        ).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot?.content_unit || master?.content_unit}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">
                        {rupiah(
                          Math.round(
                            Number(item.quantity || 0) *
                              Number(item.unit_price || 0) *
                              100,
                          ) / 100,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="block text-sm font-semibold">
            {t("Notes")}
            <textarea
              value={form.notes}
              disabled={saving}
              maxLength={4000}
              onChange={(e) =>
                setForm((current) => ({ ...current, notes: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-stone-300 p-3 font-normal"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 p-5">
          <div>
            <p className="text-xs text-stone-500">
              {selected.length} {t("selected items")}
            </p>
            <p className="text-lg font-bold">
              {t("Total")}: {rupiah(total)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
            >
              {t("Cancel")}
            </button>
            <button
              disabled={saving || !form.items.length}
              type="submit"
              className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t(saving ? "Saving..." : "Save")}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
