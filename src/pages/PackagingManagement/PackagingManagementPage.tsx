import { createExportWorksheet } from "../../utils/exportWorksheet";
import {
  Download,
  Pencil,
  Plus,
  Power,
  PackageOpen,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { isAxiosError } from "axios";
import * as XLSX from "xlsx-js-style";
import {
  createPackaging,
  deletePackaging,
  getPackagings,
  updatePackaging,
  type Packaging,
  type PackagingPayload,
} from "../../api/packaging.api";
import { getPackagingUsage } from "../../api/packaging.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: PackagingPayload = {
  code: "",
  name: "",
  active: true,
};

type ImportStatus = "success" | "failed";

interface ImportDetail {
  row: number;
  code: string;
  name: string;
  status: ImportStatus;
  reason: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  details: ImportDetail[];
}

export default function PackagingManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreatePackagings = userCan(user, "packagings", "create");
  const canUpdatePackagings = userCan(user, "packagings", "update");
  const canDeletePackagings = userCan(user, "packagings", "delete");
  const showActions = canUpdatePackagings || canDeletePackagings;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [packagingUsage, setPackagingUsage] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedPackagingIDs, setSelectedPackagingIDs] = useState<string[]>(
    [],
  );
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<Packaging | null>(
    null,
  );
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );
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
    async function loadPackagings() {
      setLoading(true);
      setError("");
      try {
        const response = await getPackagings({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextPackagings = response.data ?? [];
        setPackagings(nextPackagings);
        setTotal(response.total ?? 0);
        if (nextPackagings.length > 0) {
          const usage = await getPackagingUsage(
            nextPackagings.map((packaging) => packaging.packaging_id),
          );
          if (!current) return;
          const nextUsage = usage.data ?? {};
          setPackagingUsage(nextUsage);
          setSelectedPackagingIDs((currentIDs) =>
            currentIDs.filter(
              (packagingID) =>
                nextPackagings.some(
                  (packaging) => packaging.packaging_id === packagingID,
                ) && !nextUsage[packagingID],
            ),
          );
        } else {
          setPackagingUsage({});
          setSelectedPackagingIDs([]);
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setPackagings([]);
        setPackagingUsage({});
        setSelectedPackagingIDs([]);
        setError(response?.message || t("Could not load packaging."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadPackagings();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey]);

  function openModal(packaging?: Packaging) {
    setEditingPackaging(packaging ?? null);
    setForm(
      packaging
        ? {
            code: packaging.code,
            name: packaging.name,
            active: packaging.active,
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
    if (!form.code.trim() || !form.name.trim()) {
      setFieldErrors({ code: t("all fields are required") });
      return;
    }
    setConfirm({
      title: editingPackaging ? t("Update packaging") : t("Create packaging"),
      message: editingPackaging
        ? t("Update this packaging?")
        : t("Create this packaging?"),
      confirmText: editingPackaging
        ? t("Update packaging")
        : t("Create packaging"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingPackaging) {
        await updatePackaging(editingPackaging.packaging_id, form);
      } else {
        await createPackaging(form);
      }
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
      setActionError(
        response?.valid ? "" : response?.message || t("Action failed."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(packaging: Packaging) {
    if (packagingUsage[packaging.packaging_id]) return;
    setConfirm({
      title: t("Delete packaging"),
      message: t("Delete this packaging permanently?"),
      confirmText: t("Delete packaging"),
      tone: "danger",
      onConfirm: () => deleteConfirmed(packaging.packaging_id),
    });
  }

  async function deleteConfirmed(packagingID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deletePackaging(packagingID);
      setSelectedPackagingIDs((currentIDs) =>
        currentIDs.filter((selectedID) => selectedID !== packagingID),
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete packaging."));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelectPackaging(packaging: Packaging) {
    if (packagingUsage[packaging.packaging_id]) return;
    setSelectedPackagingIDs((currentIDs) =>
      currentIDs.includes(packaging.packaging_id)
        ? currentIDs.filter(
            (packagingID) => packagingID !== packaging.packaging_id,
          )
        : [...currentIDs, packaging.packaging_id],
    );
  }

  function toggleSelectAllAvailable() {
    if (selectablePackagings.length === 0) return;
    if (allSelectableChecked) {
      setSelectedPackagingIDs((currentIDs) =>
        currentIDs.filter(
          (packagingID) =>
            !selectablePackagings.some(
              (packaging) => packaging.packaging_id === packagingID,
            ),
        ),
      );
      return;
    }
    setSelectedPackagingIDs((currentIDs) => {
      const nextIDs = new Set(currentIDs);
      selectablePackagings.forEach((packaging) =>
        nextIDs.add(packaging.packaging_id),
      );
      return Array.from(nextIDs);
    });
  }

  function requestBatchDelete() {
    if (selectedPackagingIDs.length === 0) return;
    setConfirm({
      title: t("Delete selected packaging"),
      message: t("Delete selected packaging permanently?"),
      confirmText: t("Delete selected packaging"),
      tone: "danger",
      onConfirm: batchDeleteConfirmed,
    });
  }

  async function batchDeleteConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const ids = [...selectedPackagingIDs];
      const results = await Promise.allSettled(
        ids.map((id) => deletePackaging(id)),
      );
      const failedIDs = ids.filter(
        (_, index) => results[index].status === "rejected",
      );
      setSelectedPackagingIDs(failedIDs);
      setRefreshKey((value) => value + 1);
      if (failedIDs.length) setError(t("Could not delete selected packaging."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(packaging: Packaging) {
    if (packaging.active && packagingUsage[packaging.packaging_id]) return;
    setConfirm({
      title: packaging.active
        ? t("Deactivate packaging")
        : t("Activate packaging"),
      message: packaging.active
        ? t("Deactivate this packaging?")
        : t("Activate this packaging?"),
      confirmText: packaging.active ? t("Deactivate") : t("Activate"),
      onConfirm: () => toggleActiveConfirmed(packaging),
    });
  }

  async function toggleActiveConfirmed(packaging: Packaging) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updatePackaging(packaging.packaging_id, {
        code: packaging.code,
        name: packaging.name,
        active: !packaging.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not update packaging status."));
    } finally {
      setSubmitting(false);
    }
  }

  function writePackagingsWorkbook(exportItems: Packaging[]) {
    const header = ["KODE", "NAMA"];
    const rows = exportItems.map((packaging) => [
      packaging.code,
      packaging.name,
    ]);
    const worksheet = createExportWorksheet(header, rows, [16, 28]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Satuan Kemasan");
    XLSX.writeFile(workbook, "satuan-kemasan.xlsx");
  }

  async function exportPackagings() {
    setExporting(true);
    setError("");
    try {
      const exportItems: Packaging[] = [];
      const exportLimit = 100;
      let exportStart = 0;
      let exportTotal = total;

      do {
        const response = await getPackagings({
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

      writePackagingsWorkbook(exportItems);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not export packaging."));
    } finally {
      setExporting(false);
    }
  }

  function getImportReason(message?: string) {
    const normalized = (message ?? "").toLowerCase().trim();
    if (normalized === "packaging code already exists") {
      return t("Packaging code already exists");
    }
    if (normalized === "packaging name already exists") {
      return t("Packaging name already exists");
    }
    if (normalized === "invalid input") {
      return t("Invalid packaging input");
    }
    if (normalized === "internal server error") {
      return t("Internal server error");
    }
    return t("Import failed");
  }

  async function importPackagings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setImportSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        firstSheet,
        {
          header: 1,
          defval: "",
        },
      );
      if (
        !firstSheet ||
        String(rows[0]?.[0] ?? "")
          .trim()
          .toUpperCase() !== "KODE" ||
        String(rows[0]?.[1] ?? "")
          .trim()
          .toUpperCase() !== "NAMA"
      ) {
        throw new Error("Invalid workbook headers");
      }
      const details: ImportDetail[] = [];
      const seenCodes = new Set<string>();
      const seenNames = new Set<string>();
      const dataRows = rows.slice(1);

      for (const [index, row] of dataRows.entries()) {
        const rowNumber = index + 2;
        const code = String(row[0] ?? "")
          .trim()
          .toUpperCase();
        const name = String(row[1] ?? "").trim();
        const normalizedName = name.toLowerCase();

        if (!code && !name) {
          continue;
        }
        if (!code || !name) {
          details.push({
            row: rowNumber,
            code,
            name,
            status: "failed",
            reason: t("Code and name are required"),
          });
          continue;
        }
        if (seenCodes.has(code)) {
          details.push({
            row: rowNumber,
            code,
            name,
            status: "failed",
            reason: t("Duplicate code in import file"),
          });
          continue;
        }
        if (seenNames.has(normalizedName)) {
          details.push({
            row: rowNumber,
            code,
            name,
            status: "failed",
            reason: t("Duplicate name in import file"),
          });
          continue;
        }

        seenCodes.add(code);
        seenNames.add(normalizedName);
        try {
          await createPackaging({ code, name, active: true });
          details.push({
            row: rowNumber,
            code,
            name,
            status: "success",
            reason: t("Imported successfully"),
          });
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          details.push({
            row: rowNumber,
            code,
            name,
            status: "failed",
            reason: getImportReason(response?.message),
          });
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
        details: [
          {
            row: 0,
            code: "",
            name: "",
            status: "failed",
            reason: t("Could not read import file."),
          },
        ],
      });
    } finally {
      setImporting(false);
    }
  }

  const selectablePackagings = useMemo(
    () =>
      packagings.filter((packaging) => !packagingUsage[packaging.packaging_id]),
    [packagings, packagingUsage],
  );
  const allSelectableChecked =
    selectablePackagings.length > 0 &&
    selectablePackagings.every((packaging) =>
      selectedPackagingIDs.includes(packaging.packaging_id),
    );
  const partiallyChecked =
    selectedPackagingIDs.length > 0 && !allSelectableChecked;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 4 + (canDeletePackagings ? 1 : 0) + (showActions ? 1 : 0);
  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-accent)]">
                <PackageOpen size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">
                {t("Packaging unit")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage purchase packaging units.")}
              </p>
            </div>
            {canCreatePackagings && (
              <button
                type="button"
                onClick={() => openModal()}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                {t("Add packaging")}
              </button>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">{t("All packaging")}</h2>
                <p className="text-xs text-stone-500">
                  {total} {t("packaging found")}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setSearch(searchInput.trim());
                  }}
                  className="flex h-11 w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 focus-within:border-[var(--color-brand-accent)] focus-within:ring-4 focus-within:ring-[var(--color-brand-accent)]/10 sm:w-80"
                >
                  <Search size={17} className="text-stone-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder={t("Search packaging...")}
                  />
                </form>
                {canCreatePackagings && (
                  <>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => void importPackagings(event)}
                    />
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      disabled={importing}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                    >
                      <Upload size={16} />
                      {importing ? t("Importing...") : t("Import")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void exportPackagings()}
                  disabled={loading || exporting || total === 0}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                  <Download size={16} />
                  {exporting ? t("Exporting...") : t("Export")}
                </button>
                {canDeletePackagings && (
                  <>
                    <label className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        checked={allSelectableChecked}
                        ref={(input) => {
                          if (input) input.indeterminate = partiallyChecked;
                        }}
                        onChange={toggleSelectAllAvailable}
                        disabled={loading || selectablePackagings.length === 0}
                        className="size-4 accent-[var(--color-brand-primary)] disabled:cursor-not-allowed"
                      />
                      {t("Select all")}
                    </label>
                    <button
                      type="button"
                      onClick={requestBatchDelete}
                      disabled={selectedPackagingIDs.length === 0 || submitting}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={16} />
                      {t("Delete selected")} ({selectedPackagingIDs.length})
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
                  {t("Import finished")}: {t("Success")} {importSummary.success}
                  , {t("Failed")} {importSummary.failed}
                </p>
                <button
                  type="button"
                  onClick={() => setImportDetailOpen(true)}
                  className="self-start rounded-lg border border-green-300 px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-100 sm:self-auto"
                >
                  {t("Detail")}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    {canDeletePackagings && (
                      <th className="w-12 px-5 py-3"></th>
                    )}
                    <th className="px-5 py-3">{t("Packaging")}</th>
                    <th className="px-5 py-3">{t("Code")}</th>
                    <th className="px-5 py-3">{t("Usage")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && (
                      <th className="px-5 py-3 text-right">{t("Action")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        {t("Loading packaging...")}
                      </td>
                    </tr>
                  ) : packagings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        {t("No packaging found")}
                      </td>
                    </tr>
                  ) : (
                    packagings.map((packaging) => {
                      const inUse = Boolean(
                        packagingUsage[packaging.packaging_id],
                      );
                      return (
                        <tr
                          key={packaging.packaging_id}
                          className="hover:bg-stone-50/70"
                        >
                          {canDeletePackagings && (
                            <td className="px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selectedPackagingIDs.includes(
                                  packaging.packaging_id,
                                )}
                                onChange={() =>
                                  toggleSelectPackaging(packaging)
                                }
                                disabled={inUse}
                                className="size-4 accent-[var(--color-brand-primary)] disabled:cursor-not-allowed"
                                title={
                                  inUse
                                    ? t(
                                        "Packaging is used by ingredients or prices",
                                      )
                                    : t("Select packaging")
                                }
                              />
                            </td>
                          )}
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold">
                              {packaging.name}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold">
                            {packaging.code}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-stone-400"}`}
                              />
                              {inUse ? t("Used") : t("Unused")}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${packaging.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              {packaging.active ? t("Active") : t("Inactive")}
                            </span>
                          </td>
                          {showActions && (
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1.5">
                                {canUpdatePackagings && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openModal(packaging)}
                                      className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                      title={t("Update packaging")}
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        requestToggleActive(packaging)
                                      }
                                      disabled={packaging.active && inUse}
                                      className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                      title={
                                        packaging.active && inUse
                                          ? t(
                                              "Packaging is used by ingredients or prices",
                                            )
                                          : packaging.active
                                            ? t("Deactivate packaging")
                                            : t("Activate packaging")
                                      }
                                    >
                                      <Power size={15} />
                                    </button>
                                  </>
                                )}
                                {canDeletePackagings && (
                                  <button
                                    type="button"
                                    onClick={() => requestDelete(packaging)}
                                    disabled={inUse}
                                    className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={
                                      inUse
                                        ? t(
                                            "Packaging is used by ingredients or prices",
                                          )
                                        : t("Delete packaging")
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
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
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"
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
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitForm}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">
                {editingPackaging ? t("Update packaging") : t("Add packaging")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {(["code", "name"] as const).map((field) => (
                <label
                  key={field}
                  className="block text-sm font-semibold text-stone-700"
                >
                  {field === "code" ? t("Code") : t("Name")}
                  <input
                    maxLength={field === "code" ? 20 : 80}
                    value={form[field]}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }));
                      setFieldErrors((current) => ({
                        ...current,
                        [field]: "",
                      }));
                    }}
                    className={`mt-2 w-full rounded-lg border px-3.5 py-3 text-sm outline-none ${fieldErrors[field] ? "border-red-400 focus:ring-4 focus:ring-red-100" : "border-stone-300 focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"}`}
                    disabled={submitting}
                  />
                  {fieldErrors[field] && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      {fieldErrors[field]}
                    </p>
                  )}
                </label>
              ))}
              {actionError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t("Saving...") : t("Save")}
              </button>
            </footer>
          </form>
        </div>
      )}

      {importDetailOpen && importSummary && (
        <div className="fixed inset-0 z-85 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">{t("Import detail")}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {t("Success")} {importSummary.success}, {t("Failed")}{" "}
                  {importSummary.failed}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportDetailOpen(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="overflow-auto p-5">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">{t("Row")}</th>
                    <th className="px-4 py-3">{t("Code")}</th>
                    <th className="px-4 py-3">{t("Name")}</th>
                    <th className="px-4 py-3">{t("Status")}</th>
                    <th className="px-4 py-3">{t("Reason")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {importSummary.details.map((detail, index) => (
                    <tr key={`${detail.row}-${index}`}>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {detail.row || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {detail.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {detail.name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${detail.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                        >
                          {detail.status === "success"
                            ? t("Success")
                            : t("Failed")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600">
                        {detail.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={() => setImportDetailOpen(false)}
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
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
