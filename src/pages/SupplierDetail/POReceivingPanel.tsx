import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Info,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import {
  getPOReceiving,
  receivePO,
  type POReceiving,
} from "../../api/supplier.api";
import { getBusinessDays } from "../../api/businessDay.api";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";
import { useLanguage } from "../../app/LanguageContext";
import {
  currentBusinessDate,
  formatBusinessDate,
} from "../../utils/businessDate";
import {
  formatNumberInput,
  normalizeNumberInput,
} from "../../utils/numberFormat";
import ManagementTable from "../../components/common/ManagementTable";

const amount = (value: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(
    Number(value),
  );
const money = (value: string | number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}`;

export default function POReceivingPanel({
  supplierID,
  detailID,
  canReceive,
  onReceived,
}: {
  supplierID: string;
  detailID: string;
  canReceive: boolean;
  onReceived?: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canCheckDay = userCan(user, "business_days", "read");
  const [data, setData] = useState<POReceiving | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [date, setDate] = useState(currentBusinessDate());
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [dayRefresh, setDayRefresh] = useState(0);
  const [dayStatus, setDayStatus] = useState<
    "checking" | "open" | "closed" | "unknown"
  >("unknown");
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let current = true;
    getPOReceiving(supplierID, detailID)
      .then((result) => {
        if (current) setData(result.data ?? null);
      })
      .catch(() => {
        if (current) setError(t("Could not load PO receiving"));
      });
    return () => {
      current = false;
    };
  }, [supplierID, detailID, refresh]);

  useEffect(() => {
    if (!editing || !canCheckDay || !date) {
      setDayStatus("unknown");
      return;
    }
    let current = true;
    setDayStatus("checking");
    getBusinessDays({ start: 0, limit: 1, status: "OPEN", business_date: date })
      .then((result) => {
        if (current) setDayStatus(result.data?.length ? "open" : "closed");
      })
      .catch(() => {
        if (current) setDayStatus("unknown");
      });
    return () => {
      current = false;
    };
  }, [editing, date, canCheckDay, dayRefresh]);
  useEffect(() => {
    if (editing) formHeading.current?.focus();
  }, [editing]);

  const started = !!data?.items.some((item) => Number(item.received) > 0);
  const complete =
    !!data?.items.length &&
    data.items.every((item) => Number(item.remaining) === 0);
  const completedItems =
    data?.items.filter((item) => Number(item.remaining) === 0).length ?? 0;
  const orderedTotal =
    data?.items.reduce(
      (total, item) => total + Number(item.ordered_total),
      0,
    ) ?? 0;
  const receivedTotal =
    data?.items.reduce(
      (total, item) => total + Number(item.received_total),
      0,
    ) ?? 0;
  const selected =
    data?.items.filter((item) => Number(quantities[item.item_id] || 0) > 0) ??
    [];
  const invalidQuantity = !!data?.items.some((item) => {
    const value = quantities[item.item_id] ?? "";
    return (
      value !== "" &&
      (!/^\d{1,12}(\.\d{1,4})?$/.test(value) ||
        Number(value) > Number(item.remaining))
    );
  });
  const receiptTotal = selected.reduce(
    (total, item) =>
      total + Number(quantities[item.item_id]) * Number(item.unit_price),
    0,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      saving ||
      !selected.length ||
      invalidQuantity ||
      dayStatus === "closed" ||
      dayStatus === "checking"
    )
      return;
    const payload = {
      date,
      notes,
      items: selected.map((item) => ({
        item_id: item.item_id,
        quantity: quantities[item.item_id],
      })),
    };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await receivePO(supplierID, detailID, {
        ...payload,
        request_id: retry.current.id,
      });
      // Refresh before re-enabling receiving so the same remaining quantities cannot be reused.
      const result = await getPOReceiving(supplierID, detailID);
      setData(result.data ?? null);
      setQuantities({});
      setNotes("");
      setEditing(false);
      retry.current = null;
      setNotice(t("Goods received and stock updated"));
      onReceived?.();
    } catch (err) {
      const message = isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      setError(t(message || "Could not receive PO"));
      if (message === "Receipt date requires an open business day")
        setDayRefresh((value) => value + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 p-5">
        <div>
          <h3 className="font-semibold text-stone-900">
            {t("PO receiving progress")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">
            {t(
              "Compare the order with goods already received. Record each delivery separately.",
            )}
          </p>
        </div>
        {data && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${complete ? "bg-green-50 text-green-700" : started ? "bg-amber-50 text-amber-800" : "bg-yellow-100 text-yellow-800"}`}
          >
            {complete ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
            {t(
              complete
                ? "Received"
                : started
                  ? "Partially received"
                  : "Awaiting receipt",
            )}
          </span>
        )}
      </header>
      {notice && (
        <p
          role="status"
          className="m-5 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      {!data && (
        <div className="p-5 text-sm text-stone-500">
          {error ? (
            <>
              <p role="alert" className="text-red-700">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRefresh((value) => value + 1);
                }}
                className="mt-3 font-semibold text-[var(--color-brand-accent)]"
              >
                {t("Try again")}
              </button>
            </>
          ) : (
            t("Loading...")
          )}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
              <p className="text-xs font-semibold text-stone-500">
                {t("Order total")}
              </p>
              <p className="mt-2 text-xl font-bold text-stone-900">
                {money(orderedTotal)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {data.items.length} {t("ordered item types")}
              </p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50/50 p-4">
              <p className="text-xs font-semibold text-green-700">
                {t("Already received")}
              </p>
              <p className="mt-2 text-xl font-bold text-green-800">
                {money(receivedTotal)}
              </p>
              <p className="mt-1 text-xs text-green-700">
                {data.receipts.length} {t("recorded deliveries")}
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold text-amber-800">
                {t("Still waiting")}
              </p>
              <p className="mt-2 text-xl font-bold text-amber-900">
                {money(orderedTotal - receivedTotal)}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {data.items.length - completedItems}{" "}
                {t("item types not fully received")}
              </p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">{t("Goods progress")}</h4>
              {canReceive && !complete && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <PackageCheck size={16} />
                  {t("Record a delivery")}
                </button>
              )}
            </div>
            <ManagementTable
              label={t("Goods progress")}
              className="min-w-[600px] text-sm"
              headers={
                <>
                  {[
                    "Ingredient",
                    "Ordered",
                    "Already received",
                    "Still waiting",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {t(label)}
                    </th>
                  ))}
                </>
              }
            >
              {data.items.map((item) => (
                <tr key={item.item_id}>
                  <td className="px-4 py-4 font-medium">{item.name}</td>
                  <td className="px-4 py-4 tabular-nums">
                    {amount(item.ordered)}{" "}
                    <span className="text-xs text-stone-500">
                      {item.packaging}
                    </span>
                  </td>
                  <td className="px-4 py-4 tabular-nums text-green-700">
                    {amount(item.received)}{" "}
                    <span className="text-xs">{item.packaging}</span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {Number(item.remaining) === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <CheckCircle2 size={14} />
                        {t("Complete")}
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-800">
                        {amount(item.remaining)}{" "}
                        <span className="text-xs font-normal">
                          {item.packaging}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </ManagementTable>
          </div>
          {editing && (
            <form
              onSubmit={submit}
              className="border-t border-stone-200 bg-[var(--color-brand-cream)] p-5"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h4
                    ref={formHeading}
                    tabIndex={-1}
                    className="font-semibold outline-none"
                  >
                    {t("Record this delivery")}
                  </h4>
                  <p className="mt-1 text-sm text-stone-500">
                    {t(
                      "Enter only goods arriving now. Leave undelivered items empty.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setError("");
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-600 disabled:opacity-40"
                >
                  {t("Cancel")}
                </button>
              </div>
              <fieldset disabled={saving} className="space-y-5">
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-200 text-xs">
                      1
                    </span>
                    {t("Choose the receipt date")}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      {t("Receipt date")}
                      <input
                        required
                        type="date"
                        value={date}
                        onChange={(event) => {
                          setDate(event.target.value);
                          setError("");
                        }}
                        className="mt-2 block w-full rounded-lg border border-stone-300 bg-white p-3 outline-none focus:border-[var(--color-brand-accent)]"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      {t("Notes")}{" "}
                      <span className="font-normal text-stone-400">
                        ({t("Optional")})
                      </span>
                      <input
                        maxLength={1000}
                        value={notes}
                        placeholder={t(
                          "Example: remaining goods arrive tomorrow",
                        )}
                        onChange={(event) => setNotes(event.target.value)}
                        className="mt-2 block w-full rounded-lg border border-stone-300 bg-white p-3 outline-none focus:border-[var(--color-brand-accent)]"
                      />
                    </label>
                  </div>
                  <div
                    role="status"
                    className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${dayStatus === "closed" ? "border-amber-200 bg-amber-50 text-amber-900" : dayStatus === "open" ? "border-green-200 bg-green-50 text-green-800" : "border-stone-200 bg-white text-stone-600"}`}
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      {dayStatus === "open" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <Info size={14} />
                      )}
                      {t(
                        dayStatus === "checking"
                          ? "Checking Business Day..."
                          : dayStatus === "open"
                            ? "Business Day is open for this date"
                            : dayStatus === "closed"
                              ? "No open Business Day for this date"
                              : "Receipt date must have an open Business Day",
                      )}
                    </p>
                    {dayStatus !== "open" && dayStatus !== "checking" && (
                      <p className="mt-1">
                        {t(
                          "Stock enters the Business Day for the receipt date. Open that date first, or ask the person managing Business Day.",
                        )}
                      </p>
                    )}
                    {canCheckDay && (
                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        <Link
                          to="/business-days"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                        >
                          {t("Open Business Day page")}
                          <ArrowRight size={12} />
                        </Link>
                        <button
                          type="button"
                          disabled={dayStatus === "checking"}
                          onClick={() => setDayRefresh((value) => value + 1)}
                          className="inline-flex items-center gap-1 font-semibold disabled:opacity-40"
                        >
                          <RefreshCw size={12} />
                          {t("Check again")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-200 text-xs">
                      2
                    </span>
                    {t("Enter goods received now")}
                  </p>
                  <div className="space-y-3">
                    {data.items
                      .filter((item) => Number(item.remaining) > 0)
                      .map((item) => {
                        const value = quantities[item.item_id] || "";
                        const quantity = Number(value || 0);
                        const tooMuch = quantity > Number(item.remaining);
                        const invalid =
                          value !== "" && !/^\d{1,12}(\.\d{1,4})?$/.test(value);
                        return (
                          <div
                            key={item.item_id}
                            className="rounded-lg border border-stone-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {item.name}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {t("Still waiting")}:{" "}
                                <span className="font-semibold text-stone-700">
                                  {amount(item.remaining)} {item.packaging}
                                </span>{" "}
                                · {money(item.unit_price)} / {item.packaging}
                              </p>
                            </div>
                            <div className="mt-3 sm:mt-0 sm:w-64">
                              <label className="text-xs font-semibold text-stone-600">
                                {t("Receive now")}
                                <div
                                  className={`mt-1 flex items-center overflow-hidden rounded-lg border ${tooMuch || invalid ? "border-red-400" : "border-stone-300"}`}
                                >
                                  <input
                                    inputMode="decimal"
                                    type="text"
                                    aria-invalid={tooMuch || invalid}
                                    aria-label={`${t("Receive now")} ${item.name}`}
                                    value={formatNumberInput(value)}
                                    placeholder="0"
                                    onChange={(event) => {
                                      setQuantities((previous) => ({
                                        ...previous,
                                        [item.item_id]: normalizeNumberInput(
                                          event.target.value,
                                        ),
                                      }));
                                      setError("");
                                    }}
                                    className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                                  />
                                  <span className="shrink-0 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
                                    {item.packaging}
                                  </span>
                                </div>
                              </label>
                              <p
                                className={`mt-1 text-xs ${tooMuch || invalid ? "text-red-700" : "text-stone-500"}`}
                              >
                                {tooMuch
                                  ? t(
                                      "Received quantity exceeds remaining order",
                                    )
                                  : invalid
                                    ? t("Invalid received quantity")
                                    : `${t("Still waiting after this delivery")}: ${amount(Math.max(0, Number(item.remaining) - quantity))} ${item.packaging}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </fieldset>
              <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-6 place-items-center rounded-full bg-stone-200 text-xs">
                    3
                  </span>
                  {t("Review and save")}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold">{money(receiptTotal)}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {selected.length} {t("item types in this delivery")}
                    </p>
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-stone-500">
                      {t(
                        "Saving records this delivery and adds its goods to stock. The remaining order stays open.",
                      )}
                    </p>
                  </div>
                  <button
                    disabled={
                      saving ||
                      invalidQuantity ||
                      !selected.length ||
                      !date ||
                      dayStatus === "closed" ||
                      dayStatus === "checking"
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PackageCheck size={16} />
                    {t(saving ? "Saving..." : "Save receipt and add stock")}
                  </button>
                </div>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
            </form>
          )}
          {!editing && error && (
            <p role="alert" className="mx-5 mb-5 text-sm text-red-700">
              {error}
            </p>
          )}
          {!!data.receipts.length && (
            <div className="border-t border-stone-100 p-5">
              <h4 className="mb-3 text-sm font-semibold">
                {t("Receipt history")}
              </h4>
              <div className="space-y-2">
                {data.receipts.map((receipt, index) => (
                  <div
                    key={receipt.receipt_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"
                  >
                    <div>
                      <p className="mb-1 text-xs text-stone-500">
                        {t("Delivery")} {index + 1} ·{" "}
                        {formatBusinessDate(receipt.date)}
                      </p>
                      {receipt.notes && (
                        <p className="mt-1 text-xs text-stone-500">
                          {receipt.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {money(receipt.total)}
                      </p>
                      <p className="mt-1 text-xs text-green-700">
                        {t("Stock added")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
