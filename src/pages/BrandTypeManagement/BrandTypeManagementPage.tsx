import { createExportWorksheet } from "../../utils/exportWorksheet";
import {
  getAllCategoryIngredients,
  getIngredientSubcategories,
  type IngredientSubcategory,
  type CategoryIngredient,
} from "../../api/categoryIngredient.api";
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
import { brandTypeImportChanged } from "../../utils/brandTypeImport";
import { addIngredientCategoryDropdown } from "../../utils/ingredientCategoryDropdown";
import {
  createBrandType,
  deleteBrandType,
  getBrandTypeUsage,
  getBrandTypes,
  getAllBrandTypes,
  updateBrandType,
  type BrandType,
  type BrandTypePayload,
} from "../../api/brandType.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import UsageBadge from "../../components/common/UsageBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: BrandTypePayload = {
  subcategory_ingredient_id: "",
  category_ingredient_id: "",
  name: "",
  active: true,
};

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

export default function BrandTypeManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreate = userCan(user, "brand_types", "create");
  const canUpdate = userCan(user, "brand_types", "update");
  const canDelete = userCan(user, "brand_types", "delete");
  const showActions = canUpdate || canDelete;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [categoryIngredients, setCategoryIngredients] = useState<
    CategoryIngredient[]
  >([]);
  const [subcategories, setSubcategories] = useState<IngredientSubcategory[]>(
    [],
  );
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [items, setItems] = useState<BrandType[]>([]);
  const [brandTypeUsage, setBrandTypeUsage] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedItemIDs, setSelectedItemIDs] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BrandType | null>(null);
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
    Promise.all([getAllCategoryIngredients(), getIngredientSubcategories()])
      .then(([items, sub]) => {
        if (current) {
          setCategoryIngredients(items);
          setSubcategories(sub.data ?? []);
        }
      })
      .catch(() => {
        if (current) setError(t("Action failed."));
      });
    return () => {
      current = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let current = true;
    async function loadBrandTypes() {
      setLoading(true);
      setError("");
      try {
        const response = await getBrandTypes({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
          category_ingredient_id: categoryFilter,
          subcategory_ingredient_id: subcategoryFilter,
        });
        if (!current) return;
        const nextItems = response.data ?? [];
        setItems(nextItems);
        setTotal(response.total ?? 0);
        if (nextItems.length > 0) {
          const usage = await getBrandTypeUsage(
            nextItems.map((item) => item.brand_type_id),
          );
          if (!current) return;
          const nextUsage = usage.data ?? {};
          setBrandTypeUsage(nextUsage);
          setSelectedItemIDs((currentIDs) =>
            currentIDs.filter(
              (itemID) =>
                nextItems.some((item) => item.brand_type_id === itemID) &&
                !nextUsage[itemID],
            ),
          );
        } else {
          setBrandTypeUsage({});
          setSelectedItemIDs([]);
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setBrandTypeUsage({});
        setSelectedItemIDs([]);
        setError(response?.message || t("Could not load brand types."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadBrandTypes();
    return () => {
      current = false;
    };
  }, [page, pageSize, refreshKey, search, categoryFilter, subcategoryFilter]);

  function openModal(item?: BrandType) {
    setEditingItem(item ?? null);
    setForm(
      item
        ? {
            subcategory_ingredient_id: item.subcategory_ingredient_id || "",
            category_ingredient_id: item.category_ingredient_id,
            name: item.name,
            active: item.active,
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
    if (!form.name.trim() || !form.category_ingredient_id) {
      setFieldErrors({
        name: !form.name.trim() ? t("name is required") : "",
        category_ingredient_id: !form.category_ingredient_id
          ? t("required")
          : "",
      });
      return;
    }
    if (
      subcategories.some(
        (item) =>
          item.category_ingredient_id === form.category_ingredient_id &&
          item.active,
      ) &&
      !subcategories.some(
        (item) =>
          item.category_ingredient_id === form.category_ingredient_id &&
          item.active &&
          item.subcategory_ingredient_id === form.subcategory_ingredient_id,
      )
    ) {
      setFieldErrors({
        subcategory_ingredient_id: t("Select ingredient subcategory"),
      });
      return;
    }
    setConfirm({
      title: editingItem ? t("Update brand type") : t("Create brand type"),
      message: editingItem
        ? t("Update this brand type?")
        : t("Create this brand type?"),
      confirmText: editingItem
        ? t("Update brand type")
        : t("Create brand type"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateBrandType(editingItem.brand_type_id, form);
      } else {
        await createBrandType(form);
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

  function requestToggleActive(item: BrandType) {
    if (item.active && brandTypeUsage[item.brand_type_id]) return;
    setConfirm({
      title: item.active
        ? t("Deactivate brand type")
        : t("Activate brand type"),
      message: item.active
        ? t("Deactivate this brand type?")
        : t("Activate this brand type?"),
      confirmText: item.active ? t("Deactivate") : t("Activate"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await updateBrandType(item.brand_type_id, {
            name: item.name,
            subcategory_ingredient_id: item.subcategory_ingredient_id || "",
            category_ingredient_id: item.category_ingredient_id,
            active: !item.active,
          });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(
            response?.message || t("Could not update brand type status."),
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDelete(item: BrandType) {
    if (brandTypeUsage[item.brand_type_id]) return;
    setConfirm({
      title: t("Delete brand type"),
      message: t("Delete this brand type permanently?"),
      confirmText: t("Delete brand type"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await deleteBrandType(item.brand_type_id);
          setSelectedItemIDs((currentIDs) =>
            currentIDs.filter(
              (selectedID) => selectedID !== item.brand_type_id,
            ),
          );
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not delete brand type."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function toggleSelectItem(item: BrandType) {
    if (brandTypeUsage[item.brand_type_id]) return;
    setSelectedItemIDs((currentIDs) =>
      currentIDs.includes(item.brand_type_id)
        ? currentIDs.filter((itemID) => itemID !== item.brand_type_id)
        : [...currentIDs, item.brand_type_id],
    );
  }

  function toggleSelectAll() {
    if (items.length === 0) return;
    if (allChecked) {
      setSelectedItemIDs((currentIDs) =>
        currentIDs.filter(
          (itemID) => !items.some((item) => item.brand_type_id === itemID),
        ),
      );
      return;
    }
    setSelectedItemIDs((currentIDs) => {
      const nextIDs = new Set(currentIDs);
      selectableItems.forEach((item) => nextIDs.add(item.brand_type_id));
      return Array.from(nextIDs);
    });
  }

  function requestBatchDelete() {
    if (selectedItemIDs.length === 0) return;
    setConfirm({
      title: t("Delete selected brand types"),
      message: t("Delete selected brand types permanently?"),
      confirmText: t("Delete selected brand types"),
      tone: "danger",
      onConfirm: batchDeleteConfirmed,
    });
  }

  async function batchDeleteConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      await Promise.all(
        selectedItemIDs.map((itemID) => deleteBrandType(itemID)),
      );
      setSelectedItemIDs([]);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(
        response?.message || t("Could not delete selected brand types."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function writeBrandTypesWorkbook(
    exportItems: BrandType[],
    categories = categoryIngredients,
    exportSubcategories = subcategories,
  ) {
    const header = [
      "NAMA BRAND / TYPE",
      "STATUS",
      "KATEGORI BAHAN",
      "SUBKATEGORI BAHAN",
    ];
    const rows = exportItems.map((item) => [
      item.name,
      item.active ? "Active" : "Inactive",
      categories.find(
        (category) =>
          category.category_ingredient_id === item.category_ingredient_id,
      )?.name ?? "",
      exportSubcategories.find(
        (sub) =>
          sub.subcategory_ingredient_id === item.subcategory_ingredient_id,
      )?.name ?? "",
    ]);
    const worksheet = createExportWorksheet(header, rows, [30, 16, 25, 25]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Brand Type");
    const file = addIngredientCategoryDropdown(
      workbook,
      categories
        .filter((category) => category.active)
        .map((category) => category.name),
      exportSubcategories.filter((subcategory) => subcategory.active).map((subcategory) => subcategory.name),
    );
    const url = URL.createObjectURL(
      new Blob([file], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "brand-type.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportBrandTypes() {
    setExporting(true);
    setError("");
    try {
      const exportItems: BrandType[] = [];
      const exportLimit = 100;
      let exportStart = 0;
      let exportTotal = total;

      do {
        const response = await getBrandTypes({
          start: exportStart,
          limit: exportLimit,
          name: search,
          category_ingredient_id: categoryFilter,
          subcategory_ingredient_id: subcategoryFilter,
        });
        const nextItems = response.data ?? [];
        if (nextItems.length === 0) break;
        exportItems.push(...nextItems);
        exportTotal = response.total ?? exportItems.length;
        exportStart += nextItems.length;
      } while (exportStart < exportTotal);

      const [categories, subResponse] = await Promise.all([
        getAllCategoryIngredients(),
        getIngredientSubcategories(),
      ]);
      writeBrandTypesWorkbook(exportItems, categories, subResponse.data ?? []);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not export brand types."));
    } finally {
      setExporting(false);
    }
  }

  function getImportReason(message?: string) {
    const normalized = (message ?? "").toLowerCase().trim();
    if (normalized === "brand type name already exists") {
      return t("Brand type name already exists");
    }
    if (
      normalized === "invalid brand type input" ||
      normalized === "invalid input"
    ) {
      return t("Invalid brand type input");
    }
    if (normalized === "brand type is in use")
      return t("Brand type is used by ingredients");
    if (normalized === "internal server error") {
      return t("Internal server error");
    }
    return t("Import failed");
  }

  async function importBrandTypes(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing || (!canCreate && !canUpdate)) return;

    setImporting(true);
    setImportDetailOpen(false);
    setError("");
    setImportSummary(null);
    try {
      const [categories, existingItems, subcategoryResponse] =
        await Promise.all([
          getAllCategoryIngredients(),
          getAllBrandTypes(),
          getIngredientSubcategories(),
        ]);
      const existingByName = new Map(
        existingItems.map((item) => [item.name.trim().toLowerCase(), item]),
      );
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        firstSheet,
        {
          header: 1,
          defval: "",
        },
      );
      const subcategoryColumn =
        rows[0]?.findIndex(
          (cell) =>
            String(cell ?? "")
              .trim()
              .toUpperCase() === "SUBKATEGORI BAHAN",
        ) ?? -1;
      const importSubcategories = subcategoryResponse.data ?? [];
      const details: ImportDetail[] = [];
      const seenNames = new Set<string>();

      for (const [index, row] of rows.slice(1).entries()) {
        const rowNumber = index + 2;
        const name = String(row[0] ?? "").trim();
        const categoryName = String(row[2] ?? "")
          .trim()
          .toLowerCase();
        const category = categories.find(
          (item) =>
            item.active && item.name.trim().toLowerCase() === categoryName,
        );
        const normalizedName = name.toLowerCase();

        if (!name && !categoryName) continue;
        if (!name || !category) {
          details.push({
            row: rowNumber,
            name,
            status: "failed",
            reason: t("Name and a valid ingredient category are required"),
          });
          continue;
        }
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
          const existing = existingByName.get(normalizedName);
          const subcategoryName =
            subcategoryColumn >= 0
              ? String(row[subcategoryColumn] ?? "")
                  .trim()
                  .toLowerCase()
              : "";
          const subcategory = subcategoryName
            ? importSubcategories.find(
                (item) =>
                  item.active &&
                  item.category_ingredient_id ===
                    category.category_ingredient_id &&
                  item.name.trim().toLowerCase() === subcategoryName,
              )
            : undefined;
          if (subcategoryName && !subcategory) {
            details.push({
              row: rowNumber,
              name,
              status: "failed",
              reason: t("Invalid ingredient subcategory"),
            });
            continue;
          }
          const statusValue = String(row[1] ?? "")
            .trim()
            .toLowerCase();
          if (
            statusValue &&
            !["active", "inactive", "aktif", "nonaktif"].includes(statusValue)
          ) {
            details.push({
              row: rowNumber,
              name,
              status: "failed",
              reason: t("Invalid brand type status"),
            });
            continue;
          }
          const payload: BrandTypePayload = {
            name,
            active: statusValue
              ? ["active", "aktif"].includes(statusValue)
              : (existing?.active ?? true),
            category_ingredient_id: category.category_ingredient_id,
            subcategory_ingredient_id:
              subcategoryColumn >= 0
                ? subcategory?.subcategory_ingredient_id || ""
                : existing?.category_ingredient_id ===
                    category.category_ingredient_id
                  ? existing.subcategory_ingredient_id || ""
                  : "",
          };
          if (existing && !brandTypeImportChanged(existing, payload)) continue;
          if (
            importSubcategories.some(
              (item) =>
                item.active &&
                item.category_ingredient_id === category.category_ingredient_id,
            ) &&
            !payload.subcategory_ingredient_id
          ) {
            details.push({
              row: rowNumber,
              name,
              status: "failed",
              reason: t("Select ingredient subcategory"),
            });
            continue;
          }
          if (existing) {
            if (!canUpdate) {
              details.push({
                row: rowNumber,
                name,
                status: "failed",
                reason: t("You do not have permission to update brand types"),
              });
              continue;
            }
            await updateBrandType(existing.brand_type_id, payload);
          } else {
            if (!canCreate) {
              details.push({
                row: rowNumber,
                name,
                status: "failed",
                reason: t("You do not have permission to create brand types"),
              });
              continue;
            }
            await createBrandType(payload);
          }
          details.push({
            row: rowNumber,
            name,
            status: "success",
            reason: t(
              existing
                ? "Brand type updated successfully"
                : "Imported successfully",
            ),
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
            reason: t("Could not prepare brand type import"),
          },
        ],
      });
    } finally {
      setImporting(false);
    }
  }

  const selectableItems = items.filter(
    (item) => !brandTypeUsage[item.brand_type_id],
  );
  const allChecked =
    selectableItems.length > 0 &&
    selectableItems.every((item) =>
      selectedItemIDs.includes(item.brand_type_id),
    );
  const partiallyChecked = selectedItemIDs.length > 0 && !allChecked;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 5 + (canDelete ? 1 : 0) + (showActions ? 1 : 0);

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
                {t("Brand / Type")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage ingredient brand and type variants.")}
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => openModal()}
                className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                {t("Add brand type")}
              </button>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">{t("All brand types")}</h2>
                <p className="text-xs text-stone-500">
                  {total} {t("brand types found")}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <select
                  aria-label={t("Ingredient Category")}
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setSubcategoryFilter("");
                    setPage(1);
                  }}
                  className="h-11 rounded-lg border border-stone-200 px-3 text-sm"
                >
                  <option value="">{t("All ingredient categories")}</option>
                  {categoryIngredients.map((category) => (
                    <option
                      key={category.category_ingredient_id}
                      value={category.category_ingredient_id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("Ingredient subcategory")}
                  value={subcategoryFilter}
                  disabled={!categoryFilter}
                  onChange={(event) => {
                    setPage(1);
                    setSubcategoryFilter(event.target.value);
                  }}
                  className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none disabled:opacity-50"
                >
                  <option value="">{t("All subcategories")}</option>
                  {subcategories
                    .filter(
                      (item) => item.category_ingredient_id === categoryFilter,
                    )
                    .map((item) => (
                      <option
                        key={item.subcategory_ingredient_id}
                        value={item.subcategory_ingredient_id}
                      >
                        {item.name}
                      </option>
                    ))}
                </select>
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
                    placeholder={t("Search brand type...")}
                  />
                </form>
                {(canCreate || canUpdate) && (
                  <>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => void importBrandTypes(event)}
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
                  onClick={() => void exportBrandTypes()}
                  disabled={loading || exporting}
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
                    <th className="px-5 py-3">{t("Ingredient Category")}</th>
                    <th className="px-5 py-3">{t("Ingredient subcategory")}</th>
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
                        {t("Loading brand types...")}
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        {t("No brand types found")}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const inUse = Boolean(brandTypeUsage[item.brand_type_id]);
                      return (
                        <tr key={item.brand_type_id}>
                          {canDelete && (
                            <td className="px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selectedItemIDs.includes(
                                  item.brand_type_id,
                                )}
                                onChange={() => toggleSelectItem(item)}
                                disabled={inUse}
                                className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                                title={
                                  inUse
                                    ? t(
                                        "Brand type is used by ingredients",
                                      )
                                    : t("Select brand type")
                                }
                              />
                            </td>
                          )}
                          <td className="px-5 py-4 text-sm font-semibold">
                            {item.name}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {categoryIngredients.find(
                              (category) =>
                                category.category_ingredient_id ===
                                item.category_ingredient_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {subcategories.find(
                              (sub) =>
                                sub.subcategory_ingredient_id ===
                                item.subcategory_ingredient_id,
                            )?.name ?? "-"}
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
                                    title={t("Update brand type")}
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
                                            "Brand type is used by ingredients",
                                          )
                                        : item.active
                                          ? t("Deactivate brand type")
                                          : t("Activate brand type")
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
                                            "Brand type is used by ingredients",
                                          )
                                        : t("Delete brand type")
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

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitForm}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">
                {editingItem ? t("Update brand type") : t("Add brand type")}
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
              <label className="block text-sm font-semibold text-stone-700">
                {t("Ingredient Category")}
                <select
                  value={form.category_ingredient_id}
                  disabled={
                    submitting ||
                    !!(
                      editingItem &&
                      editingItem.category_ingredient_id &&
                      brandTypeUsage[editingItem.brand_type_id]
                    )
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category_ingredient_id: event.target.value,
                      subcategory_ingredient_id: "",
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm"
                >
                  <option value="">{t("Select ingredient category")}</option>
                  {categoryIngredients.map((category) => (
                    <option
                      key={category.category_ingredient_id}
                      value={category.category_ingredient_id}
                      disabled={!category.active}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.category_ingredient_id && (
                  <p className="mt-1.5 text-xs text-red-600">
                    {fieldErrors.category_ingredient_id}
                  </p>
                )}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Ingredient subcategory")}
                <select
                  value={form.subcategory_ingredient_id || ""}
                  disabled={
                    submitting ||
                    !form.category_ingredient_id ||
                    !subcategories.some(
                      (item) =>
                        item.active &&
                        item.category_ingredient_id ===
                          form.category_ingredient_id,
                    ) ||
                    !!(
                      editingItem?.subcategory_ingredient_id &&
                      brandTypeUsage[editingItem.brand_type_id]
                    )
                  }
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      subcategory_ingredient_id: event.target.value,
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      subcategory_ingredient_id: "",
                    }));
                  }}
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm disabled:bg-stone-50"
                >
                  <option value="">
                    {t(
                      !form.category_ingredient_id
                        ? "Select ingredient category first"
                        : subcategories.some(
                              (item) =>
                                item.active &&
                                item.category_ingredient_id ===
                                  form.category_ingredient_id,
                            )
                          ? "Select ingredient subcategory"
                          : "No subcategories",
                    )}
                  </option>
                  {subcategories
                    .filter(
                      (item) =>
                        item.category_ingredient_id ===
                        form.category_ingredient_id,
                    )
                    .map((item) => (
                      <option
                        key={item.subcategory_ingredient_id}
                        value={item.subcategory_ingredient_id}
                        disabled={!item.active}
                      >
                        {item.name}
                      </option>
                    ))}
                </select>
                {fieldErrors.subcategory_ingredient_id && (
                  <p className="mt-1.5 text-xs text-red-600">
                    {fieldErrors.subcategory_ingredient_id}
                  </p>
                )}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Name")}
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                  disabled={submitting}
                />
                {fieldErrors.name && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {fieldErrors.name}
                  </p>
                )}
              </label>
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
                className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t("Saving...") : t("Save")}
              </button>
            </footer>
          </form>
        </div>
      )}

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
