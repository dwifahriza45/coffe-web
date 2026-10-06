import SupplierShoppingForm from "./SupplierShoppingForm";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Package,
  Truck,
  Plus,
  Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getSupplier,
  getSupplierCatalog,
  getSupplierHistory,
  type Supplier,
  type SupplierCatalogItem,
  type SupplierTransaction,
} from "../../api/supplier.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import Navbar from "../../components/layout/Navbar";
import WhatsAppIcon from "../../components/common/WhatsAppIcon";
import Sidebar from "../../components/layout/Sidebar";
import { formatBusinessDate } from "../../utils/businessDate";
import {
  normalizeSupplierPhone,
  supplierWhatsAppUrl,
} from "../../utils/supplierPhone";

const PAGE_SIZE = 10;
const money = (value: string | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number(value));
const quantity = (value: string) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(
    Number(value),
  );
const safeLink = (value: string) => {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export default function SupplierDetailPage() {
  const { supplierID = "" } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canReadCatalog =
    userCan(user, "ingredients", "read");
  const canReadLegacyHistory = userCan(user, "stock_receipts", "read");
  const canReadHistory = userCan(user, "suppliers", "read");
  const canWriteShopping =
    userCan(user, "suppliers", "update") && canReadCatalog;
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [editingShopping, setEditingShopping] = useState<
    SupplierTransaction | undefined
  >();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setCatalogError("");
    setSupplier(null);
    setCatalog([]);
    setPage(1);
    setCatalogSearch("");
    async function load() {
      const results = await Promise.allSettled([
        getSupplier(supplierID),
        canReadCatalog ? getSupplierCatalog(supplierID) : Promise.resolve(null),
      ]);
      if (!current) return;
      const [supplierResult, catalogResult] = results;
      if (supplierResult.status === "fulfilled")
        setSupplier(supplierResult.value.data ?? null);
      else
        setError(
          isAxiosError(supplierResult.reason)
            ? supplierResult.reason.response?.data?.message ||
                t("Could not load supplier details")
            : t("Could not load supplier details"),
        );
      if (catalogResult.status === "fulfilled")
        setCatalog(catalogResult.value?.data ?? []);
      else setCatalogError(t("Could not load supplier catalog"));
      setLoading(false);
    }
    void load();
    return () => {
      current = false;
    };
  }, [supplierID, canReadCatalog]);

  useEffect(() => {
    let current = true;
    setHistoryLoading(true);
    setHistoryError("");
    setTransactions([]);
    setTotal(0);
    if (!canReadHistory) {
      setHistoryLoading(false);
      return;
    }
    async function load() {
      try {
        const response = await getSupplierHistory(
          supplierID,
          (page - 1) * PAGE_SIZE,
          PAGE_SIZE,
          !canReadLegacyHistory,
        );
        if (!current) return;
        setTransactions(response.data?.transactions ?? []);
        setTotal(response.data?.total ?? 0);
      } catch {
        if (current) setHistoryError(t("Could not load supplier history"));
      } finally {
        if (current) setHistoryLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [supplierID, page, canReadHistory, canReadLegacyHistory, refreshKey]);

  const filteredCatalog = catalog.filter((item) =>
    `${item.name} ${item.brand}`
      .toLowerCase()
      .includes(catalogSearch.trim().toLowerCase()),
  );
  const phone = normalizeSupplierPhone(supplier?.phone || "");
  const whatsapp = supplierWhatsAppUrl(phone);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusLabel = (status: string) =>
    ({
      RECORDED: t("Recorded"),
      DRAFT: t("Draft"),
      SUBMITTED: t("Submitted"),
      PARTIALLY_RECEIVED: t("Partially received"),
      RECEIVED: t("Received"),
    })[status] || status;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="space-y-6 p-5 sm:p-8">
          <Link
            to="/supplier-management"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft size={16} />
            {t("Back to suppliers")}
          </Link>
          {loading ? (
            <p className="py-12 text-center text-stone-500">
              {t("Loading suppliers...")}
            </p>
          ) : error ? (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-5 text-sm text-red-700"
            >
              {error}
            </p>
          ) : supplier ? (
            <>
              <header className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid size-12 place-items-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                      <Truck size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                        {t("Supplier details")}
                      </p>
                      <h1 className="mt-1 font-serif text-3xl font-bold">
                        {supplier.name}
                      </h1>
                      <p className="mt-1 text-xs text-stone-500">
                        {supplier.supplier_id}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${supplier.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                  >
                    {t(supplier.active ? "Active" : "Inactive")}
                  </span>
                </div>
                <dl className="mt-6 grid gap-5 border-t border-stone-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-semibold text-stone-500">
                      {t("Phone")}
                    </dt>
                    <dd className="mt-2 text-sm">
                      {whatsapp ? (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-green-700 no-underline hover:text-green-900"
                          aria-label={`WhatsApp ${supplier.name}: ${phone}`}
                        >
                          <WhatsAppIcon />
                          {phone}
                        </a>
                      ) : (
                        phone || "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-stone-500">
                      {t("Email")}
                    </dt>
                    <dd className="mt-2 break-all text-sm">
                      {supplier.email || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-stone-500">
                      {t("Address")}
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap text-sm">
                      {supplier.address || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-stone-500">
                      {t("Link")}
                    </dt>
                    <dd className="mt-2">
                      {supplier.link && safeLink(supplier.link) ? (
                        <a
                          href={supplier.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50"
                        >
                          <ExternalLink size={14} />
                          {t("Open link")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </header>
              {notice && (
                <p role="status" className="text-sm text-green-700">
                  {notice}
                </p>
              )}
              {canWriteShopping && (
                <button
                  type="button"
                  disabled={!supplier.active || !!catalogError}
                  onClick={() => {
                    setEditingShopping(undefined);
                    setShoppingOpen(true);
                    setNotice("");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Plus size={17} />
                  {t("Record supplier shopping")}
                </button>
              )}
              {canReadCatalog && (
                <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="flex flex-col justify-between gap-3 border-b border-stone-200 p-5 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="flex items-center gap-2 font-semibold">
                        <Package size={18} />
                        {t("Supplier ingredients")}
                      </h2>
                      <p className="mt-1 text-xs text-stone-500">
                        {t("Latest effective prices")}
                      </p>
                    </div>
                    <input
                      aria-label={t("Search ingredient...")}
                      placeholder={t("Search ingredient...")}
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#b86b42]"
                    />
                  </div>
                  {catalogError ? (
                    <p role="alert" className="p-5 text-sm text-red-700">
                      {catalogError}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-180 text-left text-sm">
                        <thead className="bg-[#948750] text-xs text-white">
                          <tr>
                            {[
                              "No",
                              "Ingredient",
                              "Brand / Type",
                              "Packaging unit",
                              "Content Qty",
                              "Price",
                              "Effective Date",
                              "Status",
                            ].map((label) => (
                              <th key={label} className="px-4 py-3">
                                {t(label)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredCatalog.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="p-10 text-center text-stone-500"
                              >
                                {t("No supplier ingredients found")}
                              </td>
                            </tr>
                          ) : (
                            filteredCatalog.map((item, index) => (
                              <tr
                                key={item.ingredient_id}
                                className="hover:bg-stone-50"
                              >
                                <td className="px-4 py-3 text-stone-500">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 font-semibold">
                                  {item.name}
                                </td>
                                <td className="px-4 py-3">
                                  {item.brand || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {item.packaging || "—"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {quantity(item.content_qty)}{" "}
                                  {item.content_unit}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {money(item.price)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {formatBusinessDate(
                                    item.effective_date || undefined,
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {t(item.active ? "Active" : "Inactive")}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
              {canReadHistory && (
                <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="border-b border-stone-200 p-5">
                    <h2 className="font-semibold">
                      {t("Supplier transaction history")}
                    </h2>
                    <p className="mt-1 text-xs text-stone-500">
                      {total} {t("transactions found")}
                    </p>
                  </div>
                  {historyError ? (
                    <p role="alert" className="p-5 text-sm text-red-700">
                      {historyError}
                    </p>
                  ) : historyLoading ? (
                    <p className="p-10 text-center text-sm text-stone-500">
                      {t("Loading transaction history...")}
                    </p>
                  ) : transactions.length === 0 ? (
                    <p className="p-10 text-center text-sm text-stone-500">
                      {t("No supplier transactions yet")}
                    </p>
                  ) : (
                    <div className="divide-y divide-stone-200">
                      {transactions.map((transaction) => (
                        <details
                          key={`${transaction.source}:${transaction.transaction_id}`}
                          className="group"
                          open={transactions.length === 1}
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 hover:bg-stone-50">
                            <div>
                              <p className="text-xs font-semibold text-stone-500">
                                {formatBusinessDate(transaction.date)} ·{" "}
                                {t(
                                  transaction.source === "purchase"
                                    ? "Purchase order"
                                    : transaction.source === "shopping"
                                      ? "Shopping record"
                                      : "Goods receipt",
                                )}
                              </p>
                              <p className="mt-1 font-semibold">
                                {transaction.number}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                                {statusLabel(transaction.status)}
                              </span>
                              <span className="text-sm font-semibold">
                                {money(transaction.total)}
                              </span>
                              <ChevronDown
                                size={18}
                                className="text-stone-400 group-open:rotate-180"
                              />
                            </div>
                          </summary>
                          <div className="border-t border-stone-100 bg-stone-50/40 p-5">
                            <div className="mb-4 flex flex-wrap justify-between gap-3 text-sm">
                              <p>
                                <span className="text-stone-500">
                                  {t("Created by")}:{" "}
                                </span>
                                {transaction.created_by || "—"}
                              </p>
                              {transaction.source === "receipt" && (
                                <Link
                                  to={`/stock-in/${encodeURIComponent(transaction.transaction_id)}`}
                                  className="font-semibold text-[#92502f] underline"
                                >
                                  {t("Open transaction")}
                                </Link>
                              )}
                            </div>
                            {transaction.source === "shopping" && (
                              <>
                                <dl className="mb-4 grid gap-4 rounded-lg border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                  {[
                                    [
                                      "Delivery date",
                                      formatBusinessDate(
                                        transaction.delivery_date || undefined,
                                      ),
                                    ],
                                    [
                                      "Payment method",
                                      transaction.payment_method,
                                    ],
                                    [
                                      "Supplier bank account",
                                      transaction.bank_account,
                                    ],
                                    ["Ship to", transaction.ship_to],
                                    ["Recipient", transaction.recipient],
                                    [
                                      "Shipping address",
                                      transaction.shipping_address,
                                    ],
                                    [
                                      "Shipping phone",
                                      transaction.shipping_phone,
                                    ],
                                  ].map(([label, value]) => (
                                    <div key={label}>
                                      <dt className="text-xs font-semibold text-stone-500">
                                        {t(label)}
                                      </dt>
                                      <dd className="mt-1 whitespace-pre-wrap">
                                        {value || "—"}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                                {canWriteShopping && (
                                  <button
                                    type="button"
                                    className="mb-4 inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold hover:bg-stone-100"
                                    onClick={() => {
                                      setEditingShopping(transaction);
                                      setShoppingOpen(true);
                                      setNotice("");
                                    }}
                                  >
                                    <Pencil size={14} />
                                    {t("Edit shopping record")}
                                  </button>
                                )}
                              </>
                            )}
                            {transaction.notes && (
                              <p className="mb-4 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-stone-600">
                                {transaction.notes}
                              </p>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-160 text-left text-sm">
                                <thead className="bg-[#948750] text-xs text-white">
                                  <tr>
                                    {[
                                      "No",
                                      "Ingredient",
                                      "Brand / Type",
                                      "Qty",
                                      "Packaging / Unit",
                                      "Price",
                                      "Content Qty",
                                      "Content unit",
                                      "Total",
                                      ...(transaction.source === "shopping" ? [] : ["Notes"]),
                                    ].map((label) => (
                                      <th key={label} className="px-3 py-3">
                                        {t(label)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 bg-white">
                                  {transaction.items.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={transaction.source === "shopping" ? 9 : 10}
                                        className="p-5 text-center text-stone-500"
                                      >
                                        {t("No transaction items")}
                                      </td>
                                    </tr>
                                  ) : (
                                    transaction.items.map((item, index) => (
                                      <tr key={index}>
                                        <td className="px-3 py-3">
                                          {index + 1}
                                        </td>
                                        <td className="px-3 py-3 font-medium">
                                          {item.name}
                                        </td>
                                        <td className="px-3 py-3">
                                          {item.brand || "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                          {quantity(item.quantity)}
                                        </td>
                                        <td className="px-3 py-3">
                                          {item.unit || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3">
                                          {money(item.unit_price)}
                                        </td>
                                        <td className="px-3 py-3">
                                          {item.content_qty
                                            ? quantity(item.content_qty)
                                            : "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                          {item.content_unit || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3">
                                          {money(item.total)}
                                        </td>
                                        {transaction.source !== "shopping" && (
                                          <td className="max-w-xs whitespace-pre-wrap px-3 py-3">
                                            {item.notes || "—"}
                                          </td>
                                        )}
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            {transaction.source === "receipt" && (
                              <p className="mt-3 text-xs text-stone-500">
                                {t("Receipt prices are not recorded")}
                              </p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                  <footer className="flex items-center justify-between border-t border-stone-200 p-5 text-xs text-stone-500">
                    <span>
                      {t("Page")} {page} {t("of")} {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={page === 1 || historyLoading}
                        onClick={() => setPage((current) => current - 1)}
                        className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                      >
                        {t("Previous")}
                      </button>
                      <button
                        disabled={page >= totalPages || historyLoading}
                        onClick={() => setPage((current) => current + 1)}
                        className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                      >
                        {t("Next")}
                      </button>
                    </div>
                  </footer>
                </section>
              )}
            </>
          ) : (
            <p className="p-10 text-center text-stone-500">
              {t("Supplier not found")}
            </p>
          )}
        </main>
      </section>
      {shoppingOpen && (
        <SupplierShoppingForm
          key={editingShopping?.transaction_id || "new"}
          supplierID={supplierID}
          supplier={supplier}
          catalog={catalog}
          editing={editingShopping}
          onClose={() => setShoppingOpen(false)}
          onSaved={() => {
            setShoppingOpen(false);
            setPage(1);
            setRefreshKey((current) => current + 1);
            setNotice(t("Shopping record saved"));
          }}
        />
      )}
    </div>
  );
}
