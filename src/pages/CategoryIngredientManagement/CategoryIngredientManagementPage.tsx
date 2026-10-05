import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  Download,
  Pencil,
  Plus,
  Power,
  Search,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import * as XLSX from "xlsx-js-style";
import {
  createCategoryIngredient,
  deleteCategoryIngredient,
  getCategoryIngredientUsage,
  getCategoryIngredients,
  updateCategoryIngredient,
  type CategoryIngredient,
  type CategoryIngredientPayload,
} from "../../api/categoryIngredient.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import UsageBadge from "../../components/common/UsageBadge";
import NameFormDialog from "../../components/common/NameFormDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: CategoryIngredientPayload = { name: "", active: true };

type ImportStatus = "success" | "failed";

interface ImportDetail {
  row: number;
  name: string;
  status: ImportStatus;
  reason: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  details: ImportDetail[];
}

export default function CategoryIngredientManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreate = userCan(user, "category_ingredient", "create");
  const canUpdate = userCan(user, "category_ingredient", "update");
  const canDelete = userCan(user, "category_ingredient", "delete");
  const showActions = canUpdate || canDelete;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<CategoryIngredient[]>([]);
  const [categoryIngredientUsage, setCategoryIngredientUsage] = useState<
    Record<string, boolean>
  >({});
  const [selectedItemIDs, setSelectedItemIDs] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CategoryIngredient | null>(
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
    async function loadCategoryIngredients() {
      setLoading(true);
      setError("");
      try {
        const response = await getCategoryIngredients({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextItems = response.data ?? [];
        setItems(nextItems);
        setTotal(response.total ?? 0);
        if (nextItems.length > 0) {
          const usage = await getCategoryIngredientUsage(
            nextItems.map((item) => item.category_ingredient_id),
          );
          if (!current) return;
          const nextUsage = usage.data ?? {};
          setCategoryIngredientUsage(nextUsage);
          setSelectedItemIDs((currentIDs) =>
            currentIDs.filter(
              (itemID) =>
                nextItems.some(
                  (item) => item.category_ingredient_id === itemID,
                ) && !nextUsage[itemID],
            ),
          );
        } else {
          setCategoryIngredientUsage({});
          setSelectedItemIDs([]);
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setCategoryIngredientUsage({});
        setSelectedItemIDs([]);
        setError(
          response?.message || t("Could not load ingredient categories."),
        );
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCategoryIngredients();
    return () => {
      current = false;
    };
  }, [page, pageSize, refreshKey, search]);

  function openModal(item?: CategoryIngredient) {
    setEditingItem(item ?? null);
    setForm(item ? { name: item.name, active: item.active } : emptyForm);
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (!form.name.trim()) {
      setFieldErrors({ name: t("name is required") });
      return;
    }
    setConfirm({
      title: editingItem
        ? t("Update ingredient category")
        : t("Create ingredient category"),
      message: editingItem
        ? t("Update this ingredient category?")
        : t("Create this ingredient category?"),
      confirmText: editingItem
        ? t("Update ingredient category")
        : t("Create ingredient category"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateCategoryIngredient(
          editingItem.category_ingredient_id,
          form,
        );
      } else {
        await createCategoryIngredient(form);
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

  function requestToggleActive(item: CategoryIngredient) {
    if (item.active && categoryIngredientUsage[item.category_ingredient_id])
      return;
    setConfirm({
      title: item.active
        ? t("Deactivate ingredient category")
        : t("Activate ingredient category"),
      message: item.active
        ? t("Deactivate this ingredient category?")
        : t("Activate this ingredient category?"),
      confirmText: item.active ? t("Deactivate") : t("Activate"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await updateCategoryIngredient(item.category_ingredient_id, {
            name: item.name,
            active: !item.active,
          });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(
            response?.message ||
              t("Could not update ingredient category status."),
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: CategoryIngredient) {
    if (categoryIngredientUsage[item.category_ingredient_id]) return;
    setConfirm({
      title: t("Delete ingredient category"),
      message: t("Delete this ingredient category permanently?"),
      confirmText: t("Delete ingredient category"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteCategoryIngredient(item.category_ingredient_id);
          setSelectedItemIDs((currentIDs) =>
            currentIDs.filter(
              (selectedID) => selectedID !== item.category_ingredient_id,
            ),
          );
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(
            response?.message || t("Could not delete ingredient category."),
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function toggleSelectItem(item: CategoryIngredient) {
    if (categoryIngredientUsage[item.category_ingredient_id]) return;
    setSelectedItemIDs((currentIDs) =>
      currentIDs.includes(item.category_ingredient_id)
        ? currentIDs.filter((itemID) => itemID !== item.category_ingredient_id)
        : [...currentIDs, item.category_ingredient_id],
    );
  }

  function toggleSelectAll() {
    if (items.length === 0) return;
    if (allChecked) {
      setSelectedItemIDs((currentIDs) =>
        currentIDs.filter(
          (itemID) =>
            !items.some((item) => item.category_ingredient_id === itemID),
        ),
      );
      return;
    }
    setSelectedItemIDs((currentIDs) => {
      const nextIDs = new Set(currentIDs);
      selectableItems.forEach((item) =>
        nextIDs.add(item.category_ingredient_id),
      );
      return Array.from(nextIDs);
    });
  }

  function requestBatchDelete() {
    if (selectedItemIDs.length === 0) return;
    setConfirm({
      title: t("Delete selected ingredient categories"),
      message: t("Delete selected ingredient categories permanently?"),
      confirmText: t("Delete selected ingredient categories"),
      tone: "danger",
      onConfirm: batchDeleteConfirmed,
    });
  }

  async function batchDeleteConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const ids = [...selectedItemIDs];
      const results = await Promise.allSettled(
        ids.map((id) => deleteCategoryIngredient(id)),
      );
      setSelectedItemIDs(
        ids.filter((_, index) => results[index].status === "rejected"),
      );
      setRefreshKey((value) => value + 1);
      if (results.some((result) => result.status === "rejected")) {
        setError(t("Could not delete selected ingredient categories."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function writeCategoryIngredientsWorkbook(exportItems: CategoryIngredient[]) {
    const header = ["NAMA KATEGORI BAHAN", "STATUS"];
    const rows = exportItems.map((item) => [
      item.name,
      item.active ? "Active" : "Inactive",
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    worksheet["!cols"] = [{ wch: 30 }, { wch: 16 }];
    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:B1");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kategori Bahan");
    XLSX.writeFile(workbook, "kategori-bahan.xlsx");
  }

  async function exportCategoryIngredients() {
    setExporting(true);
    setError("");
    try {
      const exportItems: CategoryIngredient[] = [];
      const exportLimit = 100;
      let exportStart = 0;
      let exportTotal = total;

      do {
        const response = await getCategoryIngredients({
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

      writeCategoryIngredientsWorkbook(exportItems);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(
        response?.message || t("Could not export ingredient categories."),
      );
    } finally {
      setExporting(false);
    }
  }

  function getImportReason(message?: string) {
    const normalized = (message ?? "").toLowerCase().trim();
    if (normalized === "ingredient category name already exists") {
      return t("Ingredient category name already exists");
    }
    if (
      normalized === "invalid ingredient category input" ||
      normalized === "invalid input"
    ) {
      return t("Invalid ingredient category input");
    }
    if (normalized === "internal server error") {
      return t("Internal server error");
    }
    return t("Import failed");
  }

  async function importCategoryIngredients(
    event: ChangeEvent<HTMLInputElement>,
  ) {
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
      const details: ImportDetail[] = [];
      const seenNames = new Set<string>();

      for (const [index, row] of rows.slice(1).entries()) {
        const rowNumber = index + 2;
        const name = String(row[0] ?? "").trim();
        const normalizedName = name.toLowerCase();

        if (!name) continue;
        if (seenNames.has(normalizedName)) {
          details.push({
            row: rowNumber,
            name,
            status: "failed",
            reason: t("Duplicate name in import file"),
          });
          continue;
        }

        seenNames.add(normalizedName);
        try {
          await createCategoryIngredient({ name, active: true });
          details.push({
            row: rowNumber,
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

  const selectableItems = items.filter(
    (item) => !categoryIngredientUsage[item.category_ingredient_id],
  );
  const allChecked =
    selectableItems.length > 0 &&
    selectableItems.every((item) =>
      selectedItemIDs.includes(item.category_ingredient_id),
    );
  const partiallyChecked = selectedItemIDs.length > 0 && !allChecked;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 3 + (canDelete ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <Tags size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">
                {t("Ingredient Categories")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage ingredient categories.")}
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => openModal()}
                className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                {t("Add ingredient category")}
              </button>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">
                  {t("All ingredient categories")}
                </h2>
                <p className="text-xs text-stone-500">
                  {total} {t("ingredient categories found")}
                </p>
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
                    placeholder={t("Search ingredient category...")}
                  />
                </form>
                {canCreate && (
                  <>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) =>
                        void importCategoryIngredients(event)
                      }
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
                  onClick={() => void exportCategoryIngredients()}
                  disabled={loading || exporting || total === 0}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                  <Download size={16} />
                  {exporting ? t("Exporting...") : t("Export")}
                </button>
                {canDelete && (
                  <>
                    <label className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(input) => {
                          if (input) input.indeterminate = partiallyChecked;
                        }}
                        onChange={toggleSelectAll}
                        disabled={loading || selectableItems.length === 0}
                        className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                      />
                      {t("Select all")}
                    </label>
                    <button
                      type="button"
                      onClick={requestBatchDelete}
                      disabled={selectedItemIDs.length === 0 || submitting}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={16} />
                      {t("Delete selected")} ({selectedItemIDs.length})
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
              <table className="w-full min-w-120 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    {canDelete && <th className="w-12 px-5 py-3"></th>}
                    <th className="px-5 py-3">{t("Name")}</th>
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
                        {t("Loading ingredient categories...")}
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        {t("No ingredient categories found")}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const inUse = Boolean(
                        categoryIngredientUsage[item.category_ingredient_id],
                      );
                      return (
                        <tr key={item.category_ingredient_id}>
                          {canDelete && (
                            <td className="px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selectedItemIDs.includes(
                                  item.category_ingredient_id,
                                )}
                                onChange={() => toggleSelectItem(item)}
                                disabled={inUse}
                                className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                                title={
                                  inUse
                                    ? t(
                                        "Ingredient category is used by ingredients",
                                      )
                                    : t("Select ingredient category")
                                }
                              />
                            </td>
                          )}
                          <td className="px-5 py-4 text-sm font-semibold">
                            <Link
                              to={`/category-ingredient-management/${encodeURIComponent(item.category_ingredient_id)}`}
                              className="text-[#92502f] hover:underline"
                            >
                              {item.name}
                            </Link>
                          </td>
                          <td className="px-5 py-4">
                            <UsageBadge inUse={inUse} />
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              {item.active ? t("Active") : t("Inactive")}
                            </span>
                          </td>
                          {showActions && (
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1.5">
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => openModal(item)}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                    title={t("Update ingredient category")}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                )}
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => requestToggleActive(item)}
                                    disabled={item.active && inUse}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={
                                      item.active && inUse
                                        ? t(
                                            "Ingredient category is used by ingredients",
                                          )
                                        : item.active
                                          ? t("Deactivate ingredient category")
                                          : t("Activate ingredient category")
                                    }
                                  >
                                    <Power size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => requestDelete(item)}
                                    disabled={inUse}
                                    className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={
                                      inUse
                                        ? t(
                                            "Ingredient category is used by ingredients",
                                          )
                                        : t("Delete ingredient category")
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

      <NameFormDialog
        open={modalOpen}
        title={t(
          editingItem
            ? "Update ingredient category"
            : "Add ingredient category",
        )}
        name={form.name}
        onNameChange={(name) => setForm((current) => ({ ...current, name }))}
        onSubmit={submitForm}
        onClose={() => setModalOpen(false)}
        submitting={submitting}
        nameError={fieldErrors.name}
        error={actionError}
      />

      {importDetailOpen && importSummary && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
              <table className="w-full min-w-150 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">{t("Row")}</th>
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
                className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white"
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
        onConfirm={() => void confirm?.onConfirm()}
      />
    </div>
  );
}
