import { ingredientExportHeaders, ingredientImportChanged, parseIngredientQuantity, resolveImportOption } from "../../utils/ingredientImport";
import { createExportWorksheet } from "../../utils/exportWorksheet";
import { Link } from "react-router-dom";
import {
  getAllCategoryIngredients,
  getIngredientSubcategories,
  type IngredientSubcategory,
  type CategoryIngredient,
} from "../../api/categoryIngredient.api";
import { getPackagings, type Packaging } from "../../api/packaging.api";
import { getAllSuppliers, type Supplier } from "../../api/supplier.api";
import { getAllBrandTypes, type BrandType } from "../../api/brandType.api";
import * as XLSX from "xlsx-js-style";
import { Boxes, Download, Pencil, Plus, Power, Search, Trash2, Upload, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  createIngredient,
  deleteIngredient,
  getIngredients,
  updateIngredient,
  type Ingredient,
  type IngredientPayload,
} from "../../api/ingredient.api";
import { getUnits, type Unit } from "../../api/unit.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: IngredientPayload = {
  subcategory_ingredient_id: "",
  category_ingredient_id: "",
  name: "",
  brand_type_id: "",
  supplier_id: "",
  packaging_id: "",
  package_qty: "1",
  content_qty: "",
  content_unit_id: "",
  minimum_stock: "",
  active: true,
};

export default function IngredientManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreateIngredients = userCan(user, "ingredients", "create");
  const canUpdateIngredients = userCan(user, "ingredients", "update");
  const canDeleteIngredients = userCan(user, "ingredients", "delete");
  const showActions = canUpdateIngredients || canDeleteIngredients;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categoryIngredients, setCategoryIngredients] = useState<
    CategoryIngredient[]
  >([]);
  const [subcategories, setSubcategories] = useState<IngredientSubcategory[]>(
    [],
  );
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [brandTypes, setBrandTypes] = useState<BrandType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [unitOptions, setUnitOptions] = useState<Unit[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importDetails, setImportDetails] = useState<{ row: number; name: string; status: "success" | "failed" | "skipped"; reason: string }[] | null>(null);
  const [importDetailOpen, setImportDetailOpen] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(
    null,
  );
  const [form, setForm] = useState<IngredientPayload>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    async function loadIngredients() {
      setLoading(true);
      setError("");
      try {
        const response = await getIngredients({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
          category_ingredient_id: categoryFilter,
          subcategory_ingredient_id: subcategoryFilter,
          supplier_id: supplierFilter,
        });
        if (!current) return;
        const nextIngredients = response.data ?? [];
        setIngredients(nextIngredients);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setIngredients([]);
        setError(response?.message || t("Could not load ingredients."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadIngredients();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, categoryFilter, subcategoryFilter, supplierFilter, refreshKey]);

  useEffect(() => {
    let current = true;
    async function loadOptions() {
      try {
        const [
          unitResponse,
          brandResponse,
          supplierResponse,
          packagingResponse,
          categoryResponse,
          subcategoryResponse,
        ] = await Promise.all([
          getUnits({ start: 0, limit: 100, name: "" }),
          getAllBrandTypes(),
          getAllSuppliers(),
          getPackagings({ start: 0, limit: 100, name: "" }),
          getAllCategoryIngredients(),
          getIngredientSubcategories(),
        ]);
        if (!current) return;
        setUnitOptions(unitResponse.data ?? []);
        setBrandTypes(brandResponse);
        setSuppliers(supplierResponse);
        setPackagings(packagingResponse.data ?? []);
        setCategoryIngredients(categoryResponse);
        setSubcategories(subcategoryResponse.data ?? []);
      } catch {
        if (current) {
          setUnitOptions([]);
          setBrandTypes([]);
          setSuppliers([]);
          setPackagings([]);
          setCategoryIngredients([]);
          setSubcategories([]);
          setActionError(t("Action failed."));
        }
      }
    }
    void loadOptions();
    return () => {
      current = false;
    };
  }, [modalOpen]);

  function openModal(ingredient?: Ingredient) {
    setEditingIngredient(ingredient ?? null);
    setForm(
      ingredient
        ? {
            subcategory_ingredient_id:
              ingredient.subcategory_ingredient_id || "",
            category_ingredient_id: ingredient.category_ingredient_id,
            name: ingredient.name,
            brand_type_id: ingredient.brand_type_id,
            supplier_id: ingredient.supplier_id,
            packaging_id: ingredient.packaging_id,
            package_qty: ingredient.package_qty,
            content_qty: ingredient.content_qty,
            content_unit_id: ingredient.content_unit_id,
            minimum_stock: ingredient.minimum_stock,
            active: ingredient.active,
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
    if (!form.name.trim() || !form.minimum_stock) {
      setFieldErrors({
        name: !form.name.trim() ? t("name is required") : "",
        minimum_stock: !form.minimum_stock
          ? t("minimum stock is required")
          : "",
      });
      return;
    }
    const combinationErrors: Record<string, string> = {};
    for (const key of [
      "category_ingredient_id",
      "brand_type_id",
      "supplier_id",
      "packaging_id",
      "content_unit_id",
      "package_qty",
      "content_qty",
    ] as const) {
      if (!form[key]?.trim()) combinationErrors[key] = t("required");
    }
    const availableSubcategories = subcategories.filter(
      (item) =>
        item.category_ingredient_id === form.category_ingredient_id &&
        item.active,
    );
    if (
      availableSubcategories.length &&
      !availableSubcategories.some(
        (item) =>
          item.subcategory_ingredient_id === form.subcategory_ingredient_id,
      )
    ) {
      combinationErrors.subcategory_ingredient_id = t(
        "Select ingredient subcategory",
      );
    }
    const validSelections = {
      category_ingredient_id: categoryIngredients.some(
        (item) =>
          item.category_ingredient_id === form.category_ingredient_id &&
          item.active,
      ),
      brand_type_id: brandTypes.some(
        (item) =>
          item.brand_type_id === form.brand_type_id &&
          (item.subcategory_ingredient_id || "") ===
            (form.subcategory_ingredient_id || "") &&
          item.category_ingredient_id === form.category_ingredient_id &&
          item.active &&
          categoryIngredients.some(
            (category) =>
              category.category_ingredient_id === item.category_ingredient_id &&
              category.active,
          ),
      ),
      supplier_id: suppliers.some(
        (item) => item.supplier_id === form.supplier_id && item.active,
      ),
      packaging_id: packagings.some(
        (item) => item.packaging_id === form.packaging_id && item.active,
      ),
      content_unit_id: unitOptions.some(
        (item) => item.unit_id === form.content_unit_id && item.active,
      ),
    };
    for (const key of Object.keys(
      validSelections,
    ) as (keyof typeof validSelections)[]) {
      if (!validSelections[key]) combinationErrors[key] = t("required");
    }
    for (const key of ["package_qty", "content_qty"] as const) {
      if (!Number.isFinite(Number(form[key])) || Number(form[key]) <= 0)
        combinationErrors[key] = t("invalid input");
    }
    if (Object.keys(combinationErrors).length) {
      setFieldErrors(combinationErrors);
      return;
    }
    setConfirm({
      title: editingIngredient
        ? t("Update ingredient")
        : t("Create ingredient"),
      message: editingIngredient
        ? t("Update this ingredient?")
        : t("Create this ingredient?"),
      confirmText: editingIngredient
        ? t("Update ingredient")
        : t("Create ingredient"),
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const ingredientPayload: IngredientPayload = {
        subcategory_ingredient_id: form.subcategory_ingredient_id || "",
        category_ingredient_id: form.category_ingredient_id,
        name: form.name,
        brand_type_id: form.brand_type_id,
        supplier_id: form.supplier_id,
        packaging_id: form.packaging_id,
        package_qty: form.package_qty,
        content_qty: form.content_qty,
        content_unit_id: form.content_unit_id,

        minimum_stock: form.minimum_stock,
        active: form.active,
      };
      if (editingIngredient) {
        await updateIngredient(
          editingIngredient.ingredient_id,
          ingredientPayload,
        );
      } else {
        await createIngredient(ingredientPayload);
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

  function requestDelete(ingredient: Ingredient) {
    setConfirm({
      title: t("Delete ingredient"),
      message: t("Delete this ingredient permanently?"),
      confirmText: t("Delete ingredient"),
      tone: "danger",
      onConfirm: () => deleteConfirmed(ingredient.ingredient_id),
    });
  }

  async function deleteConfirmed(ingredientID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteIngredient(ingredientID);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete ingredient."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(ingredient: Ingredient) {
    setConfirm({
      title: ingredient.active
        ? t("Deactivate ingredient")
        : t("Activate ingredient"),
      message: ingredient.active
        ? t("Deactivate this ingredient?")
        : t("Activate this ingredient?"),
      confirmText: ingredient.active ? t("Deactivate") : t("Activate"),
      onConfirm: () => toggleActiveConfirmed(ingredient),
    });
  }

  async function toggleActiveConfirmed(ingredient: Ingredient) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateIngredient(ingredient.ingredient_id, {
        subcategory_ingredient_id: ingredient.subcategory_ingredient_id || "",
        category_ingredient_id: ingredient.category_ingredient_id,
        name: ingredient.name,
        brand_type_id: ingredient.brand_type_id,
        supplier_id: ingredient.supplier_id,
        packaging_id: ingredient.packaging_id,
        package_qty: ingredient.package_qty,
        content_qty: ingredient.content_qty,
        content_unit_id: ingredient.content_unit_id,

        minimum_stock: ingredient.minimum_stock,
        active: !ingredient.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not update ingredient status."));
    } finally {
      setSubmitting(false);
    }
  }

  async function exportIngredients() {
    setExporting(true);
    setError("");
    try {
      const items: Ingredient[] = [];
      let exportTotal = total;
      do {
        const response = await getIngredients({
          start: items.length,
          limit: 100,
          name: search,
          category_ingredient_id: categoryFilter,
          subcategory_ingredient_id: subcategoryFilter,
          supplier_id: supplierFilter,
        });
        const nextItems = response.data ?? [];
        if (nextItems.length === 0) break;
        items.push(...nextItems);
        exportTotal = response.total ?? items.length;
      } while (items.length < exportTotal);

      const headers = ingredientExportHeaders.map((label) => t(label).toUpperCase());
      const rows = items.map((item) => [
        item.name,
        categoryIngredients.find((category) => category.category_ingredient_id === item.category_ingredient_id)?.name ?? item.category_ingredient_name ?? item.category_ingredient_id,
        subcategories.find((subcategory) => subcategory.subcategory_ingredient_id === item.subcategory_ingredient_id)?.name ?? item.subcategory_ingredient_id,
        brandTypes.find((brand) => brand.brand_type_id === item.brand_type_id)?.name ?? item.brand_type_id,
        suppliers.find((supplier) => supplier.supplier_id === item.supplier_id)?.name ?? item.supplier_id,
        `${formatNumber(item.package_qty, 6)} ${packagings.find((packaging) => packaging.packaging_id === item.packaging_id)?.name ?? item.packaging_id}`,
        `${formatNumber(item.content_qty, 6)} ${unitOptions.find((unit) => unit.unit_id === item.content_unit_id)?.code ?? item.content_unit_id}`,
        Number(item.minimum_stock),
      ]);
      const sheet = createExportWorksheet(headers, rows, [30, 25, 25, 25, 30, 22, 22, 16]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, t("Ingredients"));
      XLSX.writeFile(workbook, "bahan.xlsx");
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not export ingredients."));
    } finally {
      setExporting(false);
    }
  }

  async function importIngredients(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing || (!canCreateIngredients && !canUpdateIngredients)) return;
    setImporting(true);
    setError("");
    setImportDetails(null);
    setImportDetailOpen(false);
    const details: NonNullable<typeof importDetails> = [];
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Invalid ingredient import format");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const header = (rows[0] ?? []).map((cell) => String(cell).trim().toLowerCase());
      const indices = ingredientExportHeaders.map((label) => header.findIndex((cell) =>
        [label.toLowerCase(), t(label).toLowerCase(), ...({
          Ingredient: ["bahan"], "Ingredient Category": ["kategori bahan"],
          "Ingredient subcategory": ["subkategori bahan"], "Brand / Type": ["brand / type"],
          Supplier: ["supplier"], "Packaging unit": ["satuan kemasan"],
          Content: ["isi"], "Min stock": ["stok minimum", "stock minimum", "min stok"],
        }[label] ?? [])].includes(cell),
      ));
      if (indices.some((index) => index < 0) || new Set(header).size !== header.length) throw new Error("Invalid ingredient import format");
      async function allPages<T>(load: (start: number) => Promise<{ data?: T[] | null; total?: number }>) {
        const items: T[] = [];
        for (;;) {
          const response = await load(items.length);
          const next = response.data ?? [];
          items.push(...next);
          if (!next.length || items.length >= (response.total ?? items.length)) return items;
        }
      }
      const [existingItems, categories, subResponse, brands, supplierItems, packagingItems, units] = await Promise.all([
        allPages((start) => getIngredients({ start, limit: 100, name: "" })),
        getAllCategoryIngredients(), getIngredientSubcategories(), getAllBrandTypes(), getAllSuppliers(),
        allPages((start) => getPackagings({ start, limit: 100, name: "" })),
        allPages((start) => getUnits({ start, limit: 100, name: "" })),
      ]);
      const subs = subResponse.data ?? [];
      const seen = new Set<string>();
      for (const [index, row] of rows.slice(1).entries()) {
        if (row.every((cell) => !String(cell ?? "").trim())) continue;
        const cells = indices.map((column) => String(row[column] ?? "").trim());
        const [name, categoryName, subcategoryName, brandName, supplierName, packageValue, contentValue, stockValue] = cells;
        const entry = { row: index + 2, name };
        try {
          if (!name) throw new Error("Name is required");
          const normalizedName = name.toLowerCase();
          if (seen.has(normalizedName)) throw new Error("Duplicate name in import file");
          seen.add(normalizedName);
          const matches = existingItems.filter((item) => item.name.trim().toLowerCase() === normalizedName);
          if (matches.length > 1) throw new Error("Ambiguous ingredient reference");
          const existing = matches[0];
          const category = resolveImportOption(categories.filter((item) => item.active), categoryName, (item) => item.name);
          const categorySubs = subs.filter((item) => item.active && item.category_ingredient_id === category.category_ingredient_id);
          const subcategory = subcategoryName && subcategoryName !== "-"
            ? resolveImportOption(categorySubs, subcategoryName, (item) => item.name) : undefined;
          if (categorySubs.length && !subcategory) throw new Error("Select ingredient subcategory");
          const brand = resolveImportOption(brands.filter((item) => item.active && item.category_ingredient_id === category.category_ingredient_id && (item.subcategory_ingredient_id || "") === (subcategory?.subcategory_ingredient_id || "")), brandName, (item) => item.name);
          const supplier = resolveImportOption(supplierItems.filter((item) => item.active), supplierName, (item) => item.name);
          const packaging = parseIngredientQuantity(packageValue);
          const content = parseIngredientQuantity(contentValue);
          const packagingOption = resolveImportOption(packagingItems.filter((item) => item.active), packaging.unit, (item) => item.name);
          const unit = resolveImportOption(units.filter((item) => item.active), content.unit, (item) => item.code);
          const stock = stockValue.replace(/,/g, "");
          if (!/^\d+(?:\.\d+)?$/.test(stock) || !Number.isFinite(Number(stock))) throw new Error("Invalid minimum stock");
          const payload: IngredientPayload = {
            name, category_ingredient_id: category.category_ingredient_id,
            subcategory_ingredient_id: subcategory?.subcategory_ingredient_id || "",
            brand_type_id: brand.brand_type_id, supplier_id: supplier.supplier_id,
            packaging_id: packagingOption.packaging_id, package_qty: packaging.quantity,
            content_qty: content.quantity, content_unit_id: unit.unit_id,
            minimum_stock: stock, active: existing?.active ?? true,
          };
          if (existing && !ingredientImportChanged(existing, payload)) {
            details.push({ ...entry, status: "skipped", reason: t("No changes") });
            continue;
          }
          if (existing) {
            if (!canUpdateIngredients) throw new Error("You do not have permission to update ingredients");
            await updateIngredient(existing.ingredient_id, payload);
          } else {
            if (!canCreateIngredients) throw new Error("You do not have permission to create ingredients");
            await createIngredient(payload);
          }
          details.push({ ...entry, status: "success", reason: t(existing ? "Ingredient updated successfully" : "Imported successfully") });
        } catch (requestError) {
          const message = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data?.message
            : requestError instanceof Error ? requestError.message : undefined;
          details.push({ ...entry, status: "failed", reason: t(message || "Import failed") });
        }
      }
      if (!details.length) setError(t("No ingredient rows to import"));
      setImportDetails(details);
    } catch (requestError) {
      setError(t(requestError instanceof Error && requestError.message === "Invalid ingredient import format"
        ? requestError.message : "Could not prepare ingredient import"));
    } finally {
      if (details.some((item) => item.status === "success")) setRefreshKey((value) => value + 1);
      setImporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = showActions ? 11 : 10;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#e8efe5] text-[#547144]">
                <Boxes size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">
                {t("Ingredient Management")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage stock ingredients and packaging.")}
              </p>
            </div>
            {canCreateIngredients && (
              <button
                type="button"
                onClick={() => openModal()}
                className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                {t("Add ingredient")}
              </button>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="shrink-0">
                <h2 className="font-semibold">{t("All ingredients")}</h2>
                <p className="text-xs text-stone-500">
                  {total} {t("ingredients found")}
                </p>
              </div>
              <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:flex lg:flex-1 lg:items-center lg:justify-end">
                <select
                  aria-label={t("Ingredient Category")}
                  value={categoryFilter}
                  onChange={(event) => {
                    setPage(1);
                    setCategoryFilter(event.target.value);
                    setSubcategoryFilter("");
                  }}
                  className="h-11 min-w-0 w-full lg:w-40 xl:w-44 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                >
                  <option value="">{t("All categories")}</option>
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
                  className="h-11 min-w-0 w-full lg:w-40 xl:w-44 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none disabled:opacity-50"
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
                <select
                  aria-label={t("Supplier")}
                  value={supplierFilter}
                  onChange={event => { setPage(1); setSupplierFilter(event.target.value); }}
                  className="h-11 min-w-0 w-full lg:w-40 xl:w-44 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                >
                  <option value="">{t("All suppliers")}</option>
                  {suppliers.map(supplier => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
                </select>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setSearch(searchInput.trim());
                  }}
                  className="flex h-11 min-w-0 w-full lg:w-48 xl:w-60 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10"
                >
                  <Search size={17} className="shrink-0 text-stone-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder={t("Search ingredient...")}
                  />
                </form>
                {(canCreateIngredients || canUpdateIngredients) && (
                  <>
                    <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void importIngredients(event)} />
                    <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing || submitting || exporting} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent">
                      <Upload size={16} />
                      {importing ? t("Importing...") : t("Import")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void exportIngredients()}
                  disabled={loading || exporting || importing || total === 0}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                  <Download size={16} />
                  {exporting ? t("Exporting...") : t("Export")}
                </button>
              </div>
            </div>
            {importDetails && (
              <div className="m-4 rounded-lg border border-stone-200 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>{t("Import finished")}: {t("Success")} {importDetails.filter((item) => item.status === "success").length}, {t("Failed")} {importDetails.filter((item) => item.status === "failed").length}, {t("Skipped")} {importDetails.filter((item) => item.status === "skipped").length}</p>
                  <button type="button" onClick={() => setImportDetailOpen((value) => !value)} aria-expanded={importDetailOpen} className="font-semibold text-[#92502f]">{t("Import detail")}</button>
                </div>
                {importDetailOpen && (
                  <div className="mt-4 max-h-80 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr>{["Row", "Ingredient", "Status", "Reason"].map((label) => <th key={label} className="px-3 py-2">{t(label)}</th>)}</tr></thead>
                      <tbody>{importDetails.map((item) => <tr key={item.row} className="border-t border-stone-100"><td className="px-3 py-2">{item.row}</td><td className="px-3 py-2">{item.name || "—"}</td><td className={`px-3 py-2 ${item.status === "failed" ? "text-red-700" : item.status === "success" ? "text-green-700" : "text-stone-500"}`}>{t(item.status === "success" ? "Success" : item.status === "failed" ? "Failed" : "Skipped")}</td><td className="px-3 py-2">{item.reason}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("Ingredient Management")}>
              <table className="w-full min-w-[1600px] whitespace-nowrap text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Ingredient")}</th>
                    <th className="px-5 py-3">{t("Ingredient Category")}</th>
                    <th className="px-5 py-3">{t("Ingredient subcategory")}</th>
                    <th className="px-5 py-3">{t("Brand / Type")}</th>
                    <th className="px-5 py-3">{t("Supplier")}</th>
                    <th className="px-5 py-3">{t("Packaging unit")}</th>
                    <th className="px-5 py-3">{t("Content")}</th>
                    <th className="px-5 py-3">{t("Min stock")}</th>
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
                        {t("Loading ingredients...")}
                      </td>
                    </tr>
                  ) : ingredients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        {t("No ingredients found")}
                      </td>
                    </tr>
                  ) : (
                    ingredients.map((ingredient) => {
                      return (
                        <tr
                          key={ingredient.ingredient_id}
                          className="hover:bg-stone-50/70"
                        >
                          <td className="px-5 py-4">
                            <Link to={`/ingredient-management/${encodeURIComponent(ingredient.ingredient_id)}`} className="text-sm font-semibold text-[#92502f] hover:underline">
                              {ingredient.name}
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {categoryIngredients.find(
                              (item) =>
                                item.category_ingredient_id ===
                                ingredient.category_ingredient_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {subcategories.find(
                              (item) =>
                                item.subcategory_ingredient_id ===
                                ingredient.subcategory_ingredient_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {brandTypes.find(
                              (item) =>
                                item.brand_type_id === ingredient.brand_type_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {suppliers.find(
                              (item) =>
                                item.supplier_id === ingredient.supplier_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {formatNumber(ingredient.package_qty, 3)}{" "}
                            {packagings.find(
                              (item) =>
                                item.packaging_id === ingredient.packaging_id,
                            )?.name ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {formatNumber(ingredient.content_qty, 3)}{" "}
                            {unitOptions.find(
                              (item) =>
                                item.unit_id === ingredient.content_unit_id,
                            )?.code ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {formatNumber(ingredient.minimum_stock, 3)}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ingredient.in_use ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              {ingredient.in_use ? t("Used") : t("Unused")}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ingredient.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              {ingredient.active ? t("Active") : t("Inactive")}
                            </span>
                          </td>
                          {showActions && (
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1.5">
                                {canUpdateIngredients && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openModal(ingredient);
                                    }}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                    title={t("Update ingredient")}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                )}
                                {canUpdateIngredients && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      requestToggleActive(ingredient);
                                    }}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={
                                      ingredient.active
                                        ? t("Deactivate ingredient")
                                        : t("Activate ingredient")
                                    }
                                  >
                                    <Power size={15} />
                                  </button>
                                )}
                                {canDeleteIngredients && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      requestDelete(ingredient);
                                    }}
                                    className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={t("Delete ingredient")}
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
            className="max-h-[90vh] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">
                {editingIngredient
                  ? t("Update ingredient")
                  : t("Add ingredient")}
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
              <label className="block text-sm font-semibold text-stone-700">
                {t("Minimum stock")}
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={formatNumber(form.minimum_stock, 3)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minimum_stock: normalizeNumberInput(event.target.value),
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
                  disabled={submitting}
                />
                {fieldErrors.minimum_stock && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {fieldErrors.minimum_stock}
                  </p>
                )}
              </label>
              <SelectField
                label={t("Ingredient Category")}
                value={form.category_ingredient_id}
                error={fieldErrors.category_ingredient_id}
                disabled={submitting}
                onChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    category_ingredient_id: value,
                    subcategory_ingredient_id: "",
                    brand_type_id: "",
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    category_ingredient_id: "",
                    subcategory_ingredient_id: "",
                    brand_type_id: "",
                  }));
                }}
                options={categoryIngredients
                  .filter((item) => item.active)
                  .map((item) => ({
                    value: item.category_ingredient_id,
                    label: item.name,
                  }))}
              />
              <SelectField
                label={t("Ingredient subcategory")}
                value={form.subcategory_ingredient_id || ""}
                error={fieldErrors.subcategory_ingredient_id}
                disabled={
                  submitting ||
                  !form.category_ingredient_id ||
                  !subcategories.some(
                    (item) =>
                      item.category_ingredient_id ===
                        form.category_ingredient_id && item.active,
                  )
                }
                placeholder={
                  !form.category_ingredient_id
                    ? t("Select ingredient category first")
                    : subcategories.some(
                          (item) =>
                            item.category_ingredient_id ===
                              form.category_ingredient_id && item.active,
                        )
                      ? t("Select ingredient subcategory")
                      : t("No subcategories")
                }
                onChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    subcategory_ingredient_id: value,
                    brand_type_id: "",
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    subcategory_ingredient_id: "",
                    brand_type_id: "",
                  }));
                }}
                options={subcategories
                  .filter(
                    (item) =>
                      item.category_ingredient_id ===
                        form.category_ingredient_id && item.active,
                  )
                  .map((item) => ({
                    value: item.subcategory_ingredient_id,
                    label: item.name,
                  }))}
              />
              <SelectField
                label={t("Brand / Type")}
                value={form.brand_type_id}
                error={fieldErrors.brand_type_id}
                disabled={
                  submitting ||
                  (subcategories.some(
                    (item) =>
                      item.category_ingredient_id ===
                        form.category_ingredient_id && item.active,
                  ) &&
                    !form.subcategory_ingredient_id) ||
                  !categoryIngredients.some(
                    (item) =>
                      item.category_ingredient_id ===
                        form.category_ingredient_id && item.active,
                  )
                }
                placeholder={
                  !form.category_ingredient_id
                    ? t("Select ingredient category first")
                    : subcategories.some(
                          (item) =>
                            item.category_ingredient_id ===
                              form.category_ingredient_id && item.active,
                        ) && !form.subcategory_ingredient_id
                      ? t("Select ingredient subcategory")
                      : t("Select")
                }
                onChange={(value) => {
                  const selected = brandTypes.find(
                    (item) => item.brand_type_id === value,
                  );
                  setForm((current) => ({
                    ...current,
                    brand_type_id: value,
                    ...(selected
                      ? {
                          category_ingredient_id:
                            selected.category_ingredient_id,
                          subcategory_ingredient_id:
                            selected.subcategory_ingredient_id || "",
                        }
                      : {}),
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    brand_type_id: "",
                  }));
                }}
                options={brandTypes
                  .filter(
                    (item) =>
                      item.active &&
                      (item.subcategory_ingredient_id || "") ===
                        (form.subcategory_ingredient_id || "") &&
                      item.category_ingredient_id ===
                        form.category_ingredient_id &&
                      categoryIngredients.some(
                        (category) =>
                          category.category_ingredient_id ===
                            item.category_ingredient_id && category.active,
                      ),
                  )
                  .map((item) => ({
                    value: item.brand_type_id,
                    label: item.name,
                  }))}
              />
              <SelectField
                label={t("Supplier")}
                value={form.supplier_id}
                error={fieldErrors.supplier_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, supplier_id: value }))
                }
                options={suppliers
                  .filter((item) => item.active)
                  .map((item) => ({
                    value: item.supplier_id,
                    label: item.name,
                  }))}
              />
              <SelectField
                label={t("Packaging unit")}
                value={form.packaging_id}
                error={fieldErrors.packaging_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, packaging_id: value }))
                }
                options={packagings
                  .filter((item) => item.active)
                  .map((item) => ({
                    value: item.packaging_id,
                    label: `${item.name} (${item.code})`,
                  }))}
              />
              <InputField
                label={t("Package Qty")}
                value={form.package_qty}
                error={fieldErrors.package_qty}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    package_qty: normalizeNumberInput(value),
                  }))
                }
              />
              <InputField
                label={t("Content Qty")}
                value={form.content_qty}
                error={fieldErrors.content_qty}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    content_qty: normalizeNumberInput(value),
                  }))
                }
              />
              <SelectField
                label={t("Content unit")}
                value={form.content_unit_id}
                error={fieldErrors.content_unit_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, content_unit_id: value }))
                }
                options={unitOptions
                  .filter((item) => item.active)
                  .map((item) => ({
                    value: item.unit_id,
                    label: `${item.name} (${item.code})`,
                  }))}
              />
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

function InputField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <input
        inputMode="decimal"
        value={formatNumber(value, 3)}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  error,
  options,
  optional,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <select
        value={options.some((option) => option.value === value) ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
      >
        <option value="">{placeholder ?? (optional ? "-" : "Select")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}
    </label>
  );
}
