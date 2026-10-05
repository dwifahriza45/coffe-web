import { Link } from "react-router-dom";
import { ExternalLink, Download, Pencil, Plus, Power, Truck, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { isAxiosError } from "axios";
import * as XLSX from "xlsx-js-style";
import {
  createSupplier,
  deleteSupplier,
  getSupplierUsage,
  getSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierPayload,
} from "../../api/supplier.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";

import { supplierImportChanged } from "../../utils/supplierImport";
import { isValidSupplierPhone, normalizeSupplierPhone, supplierWhatsAppUrl } from "../../utils/supplierPhone";

function isValidSupplierLink(link: string): boolean {
  if (!link.trim()) return true;
  try {
    const parsed = new URL(link.trim());
    return /^https?:\/\//i.test(link.trim()) && ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password && link.trim().length <= 2048;
  } catch {
    return false;
  }
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: SupplierPayload = {
  name: "",
  phone: "",
  email: "",
  address: "",
  link: "",
  active: true,
};

type ImportStatus = "success" | "failed";

interface ImportDetail {
  row: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  link: string;
  status: ImportStatus;
  reason: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  details: ImportDetail[];
}

export default function SupplierManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreateSuppliers = userCan(user, "suppliers", "create");
  const canUpdateSuppliers = userCan(user, "suppliers", "update");
  const canDeleteSuppliers = userCan(user, "suppliers", "delete");
  const showActions = canUpdateSuppliers || canDeleteSuppliers;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierUsage, setSupplierUsage] = useState<Record<string, boolean>>({});
  const [selectedSupplierIDs, setSelectedSupplierIDs] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importDetailOpen, setImportDetailOpen] = useState(false);
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
    async function loadSuppliers() {
      setLoading(true);
      setError("");
      try {
        const response = await getSuppliers({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextSuppliers = response.data ?? [];
        setSuppliers(nextSuppliers);
        setTotal(response.total ?? 0);
        if (nextSuppliers.length > 0) {
          const usage = await getSupplierUsage(
            nextSuppliers.map((supplier) => supplier.supplier_id),
          );
          if (!current) return;
          const nextUsage = usage.data ?? {};
          setSupplierUsage(nextUsage);
          setSelectedSupplierIDs((currentIDs) =>
            currentIDs.filter((supplierID) =>
              nextSuppliers.some((supplier) => supplier.supplier_id === supplierID) &&
              !nextUsage[supplierID],
            ),
          );
        } else {
          setSupplierUsage({});
          setSelectedSupplierIDs([]);
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setSuppliers([]);
        setSupplierUsage({});
        setSelectedSupplierIDs([]);
        setError(response?.message || t("Could not load suppliers."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadSuppliers();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey]);

  function openModal(supplier?: Supplier) {
    if ((supplier ? !canUpdateSuppliers : !canCreateSuppliers) || submitting) return;
    setNotice("");
    setEditingSupplier(supplier ?? null);
    setForm(
      supplier
        ? {
            name: supplier.name,
            phone: normalizeSupplierPhone(supplier.phone),
            email: supplier.email,
            address: supplier.address,
        link: supplier.link || "",
            active: supplier.active,
          }
        : emptyForm,
    );
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (!form.name.trim()) {
      setFieldErrors({ name: t("Name is required") });
      return;
    }
    if (!isValidSupplierPhone(form.phone)) {
      setFieldErrors({ phone: t("Phone must start with 08 and contain 10–13 digits only") });
      return;
    }
    if (!isValidSupplierLink(form.link)) {
      setFieldErrors({ link: t("Link must be a valid http:// or https:// URL") });
      return;
    }
    setConfirm({
      title: editingSupplier ? t("Update supplier") : t("Create supplier"),
      message: editingSupplier ? t("Update this supplier?") : t("Create this supplier?"),
      confirmText: editingSupplier ? t("Update supplier") : t("Create supplier"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    if ((editingSupplier ? !canUpdateSuppliers : !canCreateSuppliers) || submitting) return;
    setNotice("");
    setError("");
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.supplier_id, form);
      } else {
        await createSupplier(form);
      }
      setNotice(t("Supplier saved successfully."));
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{
        message?: string;
        valid?: Record<string, string>;
      }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(supplier: Supplier) {
    if (!canDeleteSuppliers || submitting) return;
    if (supplierUsage[supplier.supplier_id]) return;
    setConfirm({
      title: t("Delete supplier"),
      message: t("Delete this supplier permanently?"),
      confirmText: t("Delete supplier"),
      tone: "danger",
      onConfirm: () => deleteConfirmed(supplier.supplier_id),
    });
  }

  async function deleteConfirmed(supplierID: string) {
    if (!canDeleteSuppliers || submitting) return;
    setNotice("");
    setError("");
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteSupplier(supplierID);
      setSelectedSupplierIDs((currentIDs) =>
        currentIDs.filter((selectedID) => selectedID !== supplierID),
      );
      setNotice(t("Supplier deleted successfully."));
      if (suppliers.length === 1 && page > 1) setPage((value) => value - 1);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete supplier."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(supplier: Supplier) {
    if (!canUpdateSuppliers || submitting) return;
    if (supplier.active && supplierUsage[supplier.supplier_id]) return;
    setConfirm({
      title: supplier.active ? t("Deactivate supplier") : t("Activate supplier"),
      message: supplier.active
        ? t("Deactivate this supplier?")
        : t("Activate this supplier?"),
      confirmText: supplier.active ? t("Deactivate") : t("Activate"),
      onConfirm: () => toggleActiveConfirmed(supplier),
    });
  }

  async function toggleActiveConfirmed(supplier: Supplier) {
    if (!canUpdateSuppliers || submitting) return;
    setNotice("");
    setError("");
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateSupplier(supplier.supplier_id, {
        name: supplier.name,
        phone: normalizeSupplierPhone(supplier.phone),
        email: supplier.email,
        address: supplier.address,
        link: supplier.link || "",
        active: !supplier.active,
      });
      setNotice(t("Supplier status updated successfully."));
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not update supplier status."));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelectSupplier(supplier: Supplier) {
    if (supplierUsage[supplier.supplier_id]) return;
    setSelectedSupplierIDs((currentIDs) =>
      currentIDs.includes(supplier.supplier_id)
        ? currentIDs.filter((supplierID) => supplierID !== supplier.supplier_id)
        : [...currentIDs, supplier.supplier_id],
    );
  }

  function toggleSelectAllAvailable() {
    if (selectableSuppliers.length === 0) return;
    if (allSelectableChecked) {
      setSelectedSupplierIDs((currentIDs) =>
        currentIDs.filter(
          (supplierID) =>
            !selectableSuppliers.some((supplier) => supplier.supplier_id === supplierID),
        ),
      );
      return;
    }
    setSelectedSupplierIDs((currentIDs) => {
      const nextIDs = new Set(currentIDs);
      selectableSuppliers.forEach((supplier) => nextIDs.add(supplier.supplier_id));
      return Array.from(nextIDs);
    });
  }

  function requestBatchDelete() {
    if (selectedSupplierIDs.length === 0) return;
    setConfirm({
      title: t("Delete selected suppliers"),
      message: t("Delete selected suppliers permanently?"),
      confirmText: t("Delete selected suppliers"),
      tone: "danger",
      onConfirm: batchDeleteConfirmed,
    });
  }

  async function batchDeleteConfirmed() {
    if (!canDeleteSuppliers || submitting) return;
    setNotice("");
    setError("");
    setConfirm(null);
    setSubmitting(true);
    try {
      await Promise.all(selectedSupplierIDs.map((supplierID) => deleteSupplier(supplierID)));
      setSelectedSupplierIDs([]);
      setNotice(t("Supplier deleted successfully."));
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete selected suppliers."));
    } finally {
      setSubmitting(false);
    }
  }

  function writeSuppliersWorkbook(exportItems: Supplier[]) {
    const header = ["NAMA", "PHONE", "EMAIL", "ADDRESS", "STATUS", "LINK"];
    const rows = exportItems.map((supplier) => [
      supplier.name,
      normalizeSupplierPhone(supplier.phone),
      supplier.email,
      supplier.address,
      supplier.active ? "Active" : "Inactive",
      supplier.link || "",
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    worksheet["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 32 }, { wch: 42 }, { wch: 14 }, { wch: 48 }];
    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:F1");
    const border = {
      top: { style: "thin", color: { rgb: "B8A99F" } },
      right: { style: "thin", color: { rgb: "B8A99F" } },
      bottom: { style: "thin", color: { rgb: "B8A99F" } },
      left: { style: "thin", color: { rgb: "B8A99F" } },
    };
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        if (!worksheet[address]) continue;
        worksheet[address].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
          ...(row === 0
            ? {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "362219" }, patternType: "solid" },
              }
            : {}),
        };
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
    XLSX.writeFile(workbook, "suppliers.xlsx");
  }

  async function exportSuppliers() {
    setExporting(true);
    setError("");
    try {
      const exportItems: Supplier[] = [];
      const exportLimit = 100;
      let exportStart = 0;
      let exportTotal = total;
      do {
        const response = await getSuppliers({
          start: exportStart,
          limit: exportLimit,
          name: search,
        });
        const nextItems = response.data ?? [];
        if (nextItems.length === 0) break;
        exportItems.push(...nextItems);
        exportTotal = response.total ?? exportItems.length;
        exportStart += nextItems.length;
      } while (exportStart < exportTotal);
      writeSuppliersWorkbook(exportItems);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not export suppliers."));
    } finally {
      setExporting(false);
    }
  }

  function getImportReason(message?: string) {
    const normalized = (message ?? "").toLowerCase().trim();
    if (normalized === "supplier name already exists") return t("Supplier name already exists");
    if (normalized === "invalid input") return t("Invalid supplier input");
    if (normalized === "supplier is in use") return t("Supplier is used by purchases or prices");
    if (normalized === "internal server error") return t("Internal server error");
    return t("Import failed");
  }

  async function importSuppliers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing || (!canCreateSuppliers && !canUpdateSuppliers)) return;

    setImporting(true);
    setImportDetailOpen(false);
    setError("");
    setImportSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, {
        header: 1,
        defval: "",
      });
      const linkColumn = rows[0]?.findIndex((cell) => String(cell ?? "").trim().toUpperCase() === "LINK") ?? -1;
      const statusColumn = rows[0]?.findIndex((cell) => String(cell ?? "").trim().toUpperCase() === "STATUS") ?? -1;
      const existingByName = new Map<string, Supplier>();
      for (let start = 0; ;) {
        const response = await getSuppliers({ start, limit: 100, name: "" });
        const items = response.data ?? [];
        items.forEach((item) => existingByName.set(item.name.trim().toLowerCase(), item));
        start += items.length;
        if (!items.length || start >= (response.total ?? start)) break;
      }
      const details: ImportDetail[] = [];
      const seenNames = new Set<string>();

      for (const [index, row] of rows.slice(1).entries()) {
        const rowNumber = index + 2;
        const name = String(row[0] ?? "").trim();
        const phone = String(row[1] ?? "").trim();
        const email = String(row[2] ?? "").trim();
        const address = String(row[3] ?? "").trim();
        const link = linkColumn >= 0 ? String(row[linkColumn] ?? "").trim() : "";
        const normalizedName = name.toLowerCase();

        if (!name && !phone && !email && !address && !link) continue;
        if (!name) {
          details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("Name is required") });
          continue;
        }
        if (!isValidSupplierPhone(phone)) {
          details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("Phone must start with 08 and contain 10–13 digits only") });
          continue;
        }
        if (!isValidSupplierLink(link)) {
          details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("Link must be a valid http:// or https:// URL") });
          continue;
        }
        if (seenNames.has(normalizedName)) {
          details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("Duplicate name in import file") });
          continue;
        }

        seenNames.add(normalizedName);
        try {
          const existing = existingByName.get(normalizedName);
          const statusValue = statusColumn >= 0 ? String(row[statusColumn] ?? "").trim().toLowerCase() : "";
          if (statusValue && !["active", "inactive", "aktif", "nonaktif"].includes(statusValue)) {
            details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("Invalid supplier status") });
            continue;
          }
          const payload: SupplierPayload = {
            name, phone, email, address,
            link: linkColumn >= 0 ? link : existing?.link || "",
            active: statusValue ? ["active", "aktif"].includes(statusValue) : existing?.active ?? true,
          };
          if (existing) {
            if (!supplierImportChanged(existing, payload)) continue;
            if (!canUpdateSuppliers) {
              details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("You do not have permission to update suppliers") });
              continue;
            }
            await updateSupplier(existing.supplier_id, payload);
          } else {
            if (!canCreateSuppliers) {
              details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: t("You do not have permission to create suppliers") });
              continue;
            }
            await createSupplier(payload);
          }
          details.push({ row: rowNumber, name, phone, email, address, link, status: "success", reason: t(existing ? "Supplier updated successfully" : "Imported successfully") });
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          details.push({ row: rowNumber, name, phone, email, address, link, status: "failed", reason: getImportReason(response?.message) });
        }
      }

      const summary = details.reduce<ImportSummary>(
        (current, detail) => ({
          success: current.success + (detail.status === "success" ? 1 : 0),
          failed: current.failed + (detail.status === "failed" ? 1 : 0),
          details: [...current.details, detail],
        }),
        { success: 0, failed: 0, details: [] },
      );
      setImportSummary(summary);
      setRefreshKey((value) => value + 1);
    } catch {
      setImportSummary({
        success: 0,
        failed: 1,
        details: [{ row: 0, name: "", phone: "", email: "", address: "", link: "", status: "failed", reason: t("Could not prepare supplier import") }],
      });
    } finally {
      setImporting(false);
    }
  }

  const selectableSuppliers = suppliers.filter((supplier) => !supplierUsage[supplier.supplier_id]);
  const allSelectableChecked =
    selectableSuppliers.length > 0 &&
    selectableSuppliers.every((supplier) => selectedSupplierIDs.includes(supplier.supplier_id));
  const partiallyChecked = selectedSupplierIDs.length > 0 && !allSelectableChecked;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 7 + (canDeleteSuppliers ? 1 : 0) + (showActions ? 1 : 0);
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <Truck size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("Suppliers")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage supplier contacts and availability.")}
              </p>
            </div>
            {canCreateSuppliers && <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              {t("Add supplier")}
            </button>}
          </header>

          {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">{t("All suppliers")}</h2>
                <p className="text-xs text-stone-500">{total} {t("suppliers found")}</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setSearch(searchInput.trim());
                  }}
                  className="flex h-11 w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10 sm:w-80"
                >
                  <Search size={17} className="text-stone-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder={t("Search supplier...")}
                  />
                </form>
                {(canCreateSuppliers || canUpdateSuppliers) && (
                  <>
                    <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void importSuppliers(event)} />
                    <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent">
                      <Upload size={16} />
                      {importing ? t("Importing...") : t("Import")}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => void exportSuppliers()} disabled={loading || exporting || total === 0} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent">
                  <Download size={16} />
                  {exporting ? t("Exporting...") : t("Export")}
                </button>
                {canDeleteSuppliers && (
                  <>
                    <label className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        checked={allSelectableChecked}
                        ref={(input) => {
                          if (input) input.indeterminate = partiallyChecked;
                        }}
                        onChange={toggleSelectAllAvailable}
                        disabled={loading || selectableSuppliers.length === 0}
                        className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                      />
                      {t("Select all")}
                    </label>
                    <button type="button" onClick={requestBatchDelete} disabled={selectedSupplierIDs.length === 0 || submitting} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent">
                      <Trash2 size={16} />
                      {t("Delete selected")} ({selectedSupplierIDs.length})
                    </button>
                  </>
                )}
              </div>
            </div>
            {error && (
              <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {importSummary && (
              <div className="m-4 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">
                  {t("Import finished")}: {t("Success")} {importSummary.success}, {t("Failed")} {importSummary.failed}
                </p>
                <button type="button" onClick={() => setImportDetailOpen(true)} className="self-start rounded-lg border border-green-300 px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-100 sm:self-auto">
                  {t("Detail")}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    {canDeleteSuppliers && <th className="w-12 px-5 py-3"></th>}
                    <th className="px-5 py-3">{t("Supplier")}</th>
                    <th className="px-5 py-3">{t("Phone")}</th>
                    <th className="px-5 py-3">{t("Email")}</th>
                    <th className="px-5 py-3">{t("Address")}</th>
                    <th className="px-5 py-3">{t("Link")}</th>
                    <th className="px-5 py-3">{t("Usage")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("Loading suppliers...")}
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("No suppliers found")}
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => {
                      const inUse = Boolean(supplierUsage[supplier.supplier_id]);
                      const phone = normalizeSupplierPhone(supplier.phone);
                      const whatsappUrl = supplierWhatsAppUrl(phone);
                      return (
                      <tr key={supplier.supplier_id} className="hover:bg-stone-50/70">
                        {canDeleteSuppliers && (
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              checked={selectedSupplierIDs.includes(supplier.supplier_id)}
                              onChange={() => toggleSelectSupplier(supplier)}
                              disabled={inUse}
                              className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                              title={inUse ? t("Supplier is used by purchases or prices") : t("Select supplier")}
                            />
                          </td>
                        )}
                        <td className="px-5 py-4">
                          <Link to={`/supplier-management/${encodeURIComponent(supplier.supplier_id)}`} className="text-sm font-semibold text-[#92502f] hover:underline">{supplier.name}</Link>
                          <p className="mt-1 text-xs text-stone-500">{supplier.supplier_id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-green-700 underline underline-offset-4 hover:text-green-900" aria-label={`WhatsApp ${supplier.name}: ${phone}`}>
                              {phone}
                            </a>
                          ) : phone || "-"}
                        </td>
                        <td className="px-5 py-4 text-sm">{supplier.email || "-"}</td>
                        <td className="max-w-xs whitespace-pre-wrap break-words px-5 py-4 text-sm">{supplier.address || "-"}</td>
                        <td className="px-5 py-4 text-sm">
                          {supplier.link && isValidSupplierLink(supplier.link) ? (
                            <a href={supplier.link.trim()} target="_blank" rel="noopener noreferrer" title={supplier.link} aria-label={`${t("Open link")}: ${supplier.name}`} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86b42]">
                              <ExternalLink size={14} />
                              {t("Open link")}
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                            <span className={`size-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-stone-400"}`} />
                            {inUse ? t("Used") : t("Unused")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${supplier.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {supplier.active ? t("Active") : t("Inactive")}
                          </span>
                        </td>
                        {showActions && <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {canUpdateSuppliers && <button
                              type="button"
                              onClick={() => openModal(supplier)}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                              title={t("Update supplier")}
                            >
                              <Pencil size={15} />
                            </button>}
                            {canUpdateSuppliers && <button
                              type="button"
                              onClick={() => requestToggleActive(supplier)}
                              disabled={supplier.active && inUse}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title={supplier.active && inUse ? t("Supplier is used by purchases or prices") : supplier.active ? t("Deactivate supplier") : t("Activate supplier")}
                            >
                              <Power size={15} />
                            </button>}
                            {canDeleteSuppliers && <button
                              type="button"
                              onClick={() => requestDelete(supplier)}
                              disabled={inUse}
                              className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title={inUse ? t("Supplier is used by purchases or prices") : t("Delete supplier")}
                            >
                              <Trash2 size={15} />
                            </button>}
                          </div>
                        </td>}
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">
                  {t("Page")} {page} {t("of")} {totalPages}
                </p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Limit")}
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPage(1);
                      setPageSize(Number(event.target.value));
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {t("Previous")}
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {t("Next")}
                </button>
              </div>
            </footer>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingSupplier ? t("Update supplier") : t("Add supplier")}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {(["name", "phone", "email", "address", "link"] as const).map((field) => (
                <label key={field} className="block text-sm font-semibold text-stone-700">
                  {({ name: t("Name"), phone: t("Phone"), email: t("Email"), address: t("Address"), link: t("Link") })[field]}{field === "name" ? " *" : ""}
                  <input
                    type={field === "link" ? "url" : field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    required={field === "name"}
                    minLength={field === "name" ? 2 : undefined}
                    maxLength={({ name: 120, phone: 30, email: 254, address: 1000, link: 2048 })[field]}
                    value={form[field]}
                    placeholder={field === "phone" ? "08xxxxxxxxxx" : field === "link" ? "https://shopee.co.id/..." : undefined}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, [field]: event.target.value }));
                      setFieldErrors((current) => ({ ...current, [field]: "" }));
                    }}
                    className={`mt-2 w-full rounded-lg border px-3.5 py-3 text-sm outline-none ${fieldErrors[field] ? "border-red-400 focus:ring-4 focus:ring-red-100" : "border-stone-300 focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"}`}
                    disabled={submitting}
                  />
                  {fieldErrors[field] && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors[field]}</p>
                  )}
                </label>
              ))}
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-start gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">
                {t("Cancel")}
              </button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? t("Saving...") : t("Save")}
              </button>
            </footer>
          </form>
        </div>
      )}

      {importDetailOpen && importSummary && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">{t("Import detail")}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {t("Success")} {importSummary.success}, {t("Failed")} {importSummary.failed}
                </p>
              </div>
              <button type="button" onClick={() => setImportDetailOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </header>
            <div className="overflow-auto p-5">
              <table className="w-full min-w-220 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">{t("Row")}</th>
                    <th className="px-4 py-3">{t("Name")}</th>
                    <th className="px-4 py-3">{t("Phone")}</th>
                    <th className="px-4 py-3">{t("Email")}</th>
                    <th className="px-4 py-3">{t("Address")}</th>
                    <th className="px-4 py-3">{t("Status")}</th>
                    <th className="px-4 py-3">{t("Reason")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {importSummary.details.map((detail, index) => (
                    <tr key={`${detail.row}-${index}`}>
                      <td className="px-4 py-3 text-sm font-semibold">{detail.row || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.name || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.phone || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.email || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.address || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${detail.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          {detail.status === "success" ? t("Success") : t("Failed")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600">{detail.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t border-stone-200 p-5">
              <button type="button" onClick={() => setImportDetailOpen(false)} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white">
                {t("Close")}
              </button>
            </footer>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText ?? t("Confirm")}
        tone={confirm?.tone}
        submitting={submitting}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void confirm?.onConfirm();
        }}
      />
    </div>
  );
}
