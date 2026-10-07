import { createExportWorksheet } from "../../utils/exportWorksheet";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Download,
  Upload,
  Search,
  Pencil,
  Plus,
  Power,
  Trash2,
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
import { Link, useParams } from "react-router-dom";
import {
  getCategoryIngredient,
  getIngredientSubcategories,
  saveIngredientSubcategory,
  deleteIngredientSubcategory,
  type CategoryIngredient,
  type IngredientSubcategory,
} from "../../api/categoryIngredient.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import UsageBadge from "../../components/common/UsageBadge";
import NameFormDialog from "../../components/common/NameFormDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

function IngredientSubcategoriesPage() {
  const { categoryID = "" } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreate = userCan(user, "category_ingredient", "create");
  const canUpdate = userCan(user, "category_ingredient", "update");
  const canDelete = userCan(user, "category_ingredient", "delete");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [parent, setParent] = useState<CategoryIngredient | null>(null);
  const [items, setItems] = useState<IngredientSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<IngredientSubcategory | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [importing, setImporting] = useState(false);
  const [importDetails, setImportDetails] = useState<
    | {
        row: number;
        name: string;
        status: "success" | "failed";
        reason: string;
      }[]
    | null
  >(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const busy = saving || importing;
  const filtered = items.filter((item) =>
    item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    tone?: "default" | "danger";
    confirmText?: string;
  } | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setParent(null);
    setItems([]);
    Promise.all([
      getCategoryIngredient(categoryID),
      getIngredientSubcategories(categoryID),
    ])
      .then(([category, sub]) => {
        if (current) {
          setParent(category.data ?? null);
          setItems(sub.data ?? []);
        }
      })
      .catch(() => {
        if (current) setError(t("Could not load ingredient subcategories"));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [categoryID, refresh]);
  const errorMessage = (err: unknown) => {
    const message = isAxiosError(err) ? err.response?.data?.message : "";
    return message === "ingredient category name already exists"
      ? t("Subcategory name already exists")
      : message === "ingredient category is in use"
        ? t("Subcategory is used by ingredients")
        : t("Action failed.");
  };
  function open(item?: IngredientSubcategory) {
    setNameError("");
    setEditing(item ?? null);
    setName(item?.name ?? "");
    setError("");
    setNotice("");
    setModal(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNameError("");
    setError("");
    if (!name.trim()) {
      setNameError(t("name is required"));
      return;
    }
    if (name.trim().length > 150) {
      setNameError(t("Subcategory name is too long"));
      return;
    }
    setConfirm({
      title: t(editing ? "Edit subcategory" : "Add subcategory"),
      message: t(
        editing
          ? "Save changes to this subcategory?"
          : "Create this subcategory?",
      ),
      action: saveForm,
      confirmText: t(editing ? "Edit subcategory" : "Add subcategory"),
    });
  }
  async function saveForm() {
    setConfirm(null);
    if (busy || (!editing && !canCreate) || (editing && !canUpdate)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveIngredientSubcategory(
        categoryID,
        { name: name.trim(), active: editing?.active ?? true },
        editing?.subcategory_ingredient_id,
      );
      setModal(false);
      setNotice(t("Subcategory saved"));
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setConfirm(null);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setRefresh((value) => value + 1);
      setNotice(t("Subcategories updated"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  function exportItems() {
    const sheet = createExportWorksheet(
      ["NAMA SUBKATEGORI BAHAN", "STATUS", "KATEGORI BAHAN"],
      filtered.map((item) => [
        item.name,
        item.active ? "Active" : "Inactive",
        parent?.name ?? "",
      ]),
      [32, 16, 28],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Subkategori Bahan");
    XLSX.writeFile(workbook, "subkategori-bahan.xlsx");
  }
  async function importItems(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || !parent?.active) return;
    setImporting(true);
    setError("");
    setNotice("");
    setImportDetails(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("empty workbook");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      });
      if (
        String(rows[0]?.[0] ?? "")
          .trim()
          .toUpperCase() !== "NAMA SUBKATEGORI BAHAN"
      ) {
        setError(t("Invalid subcategory import format"));
        return;
      }
      const latest = (await getIngredientSubcategories(categoryID)).data ?? [];
      const existing = new Map(
        latest.map((item) => [item.name.trim().toLocaleLowerCase(), item]),
      );
      const seen = new Set<string>();
      const details: NonNullable<typeof importDetails> = [];
      for (const [index, row] of rows.slice(1).entries()) {
        if (row.every((cell) => !String(cell ?? "").trim())) continue;
        const name = String(row[0] ?? "").trim();
        const key = name.toLocaleLowerCase();
        const status = String(row[1] ?? "")
          .trim()
          .toLowerCase();
        const category = String(row[2] ?? "").trim();
        try {
          if (!name) throw new Error(t("Name is required"));
          if (name.length > 150)
            throw new Error(t("Subcategory name is too long"));
          if (seen.has(key))
            throw new Error(t("Duplicate name in import file"));
          seen.add(key);
          if (
            category &&
            category.toLocaleLowerCase() !==
              parent.name.trim().toLocaleLowerCase()
          )
            throw new Error(t("Subcategory import category mismatch"));
          if (
            status &&
            !["active", "inactive", "aktif", "nonaktif"].includes(status)
          )
            throw new Error(t("Invalid status"));
          const old = existing.get(key);
          const active = status
            ? ["active", "aktif"].includes(status)
            : (old?.active ?? true);
          if (old && old.name === name && old.active === active) continue;
          if (old ? !canUpdate : !canCreate)
            throw new Error(t("Action not allowed"));
          await saveIngredientSubcategory(
            categoryID,
            { name, active },
            old?.subcategory_ingredient_id,
          );
          details.push({
            row: index + 2,
            name,
            status: "success",
            reason: t("Imported successfully"),
          });
        } catch (err) {
          details.push({
            row: index + 2,
            name,
            status: "failed",
            reason: isAxiosError(err)
              ? errorMessage(err)
              : err instanceof Error
                ? err.message
                : t("Import failed"),
          });
        }
      }
      setImportDetails(details);
      setRefresh((value) => value + 1);
    } catch {
      setError(t("Import failed"));
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link
            to="/category-ingredient-management"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600"
          >
            <ArrowLeft size={16} />
            {t("Back to ingredient categories")}
          </Link>
          <header className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">
                {t("Ingredient subcategories")}
              </p>
              <h1 className="mt-1 font-serif text-3xl font-bold">
                {parent?.name || t("Ingredient Category")}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage ingredient groups within this category")}
              </p>
            </div>
            {canCreate && (
              <button
                disabled={loading || !parent?.active || busy}
                onClick={() => open()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Plus size={17} />
                {t("Add subcategory")}
              </button>
            )}
          </header>
          {error && !modal && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm text-green-700">
              {notice}
            </p>
          )}
          <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 p-4">
              <div>
                <h2 className="font-bold">{t("Ingredient subcategories")}</h2>
                <p className="text-xs text-stone-500">
                  {filtered.length} {t("Subcategories found")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-3">
                  <Search size={16} className="text-stone-400" />
                  <input
                    aria-label={t("Search subcategory...")}
                    placeholder={t("Search subcategory...")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-52 text-sm outline-none"
                  />
                </label>
                {(canCreate || canUpdate) && (
                  <>
                    <input
                      ref={importInput}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => void importItems(event)}
                    />
                    <button
                      disabled={busy || loading || !parent?.active}
                      onClick={() => importInput.current?.click()}
                      className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold disabled:opacity-40"
                    >
                      <Upload size={16} />
                      {t(importing ? "Importing..." : "Import")}
                    </button>
                  </>
                )}
                <button
                  disabled={busy || loading}
                  onClick={exportItems}
                  className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold disabled:opacity-40"
                >
                  <Download size={16} />
                  {t("Export")}
                </button>
              </div>
            </div>
            {importDetails && (
              <div className="m-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p>
                  {t("Import finished")}: {t("Success")}{" "}
                  {importDetails.filter((d) => d.status === "success").length},{" "}
                  {t("Failed")}{" "}
                  {importDetails.filter((d) => d.status === "failed").length}
                </p>
                <button
                  onClick={() => setDetailOpen(true)}
                  className="rounded-lg border border-green-300 px-3 py-2 font-semibold"
                >
                  {t("Detail")}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-120 text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Ingredient subcategory")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    <th className="px-5 py-3">{t("Usage")}</th>
                    {(canUpdate || canDelete) && (
                      <th className="px-5 py-3 text-right">{t("Action")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading || !visible.length ? (
                    <tr>
                      <td
                        colSpan={canUpdate || canDelete ? 4 : 3}
                        className="p-10 text-center text-stone-500"
                      >
                        {t(loading ? "Loading..." : "No subcategories")}
                      </td>
                    </tr>
                  ) : (
                    visible.map((item) => (
                      <tr key={item.subcategory_ingredient_id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {parent?.name} → {item.name}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                          >
                            {t(item.active ? "Active" : "Inactive")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <UsageBadge inUse={item.in_use} />
                        </td>
                        {(canUpdate || canDelete) && (
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {canUpdate && (
                                <>
                                  <button
                                    disabled={busy || !parent?.active}
                                    title={t("Edit subcategory")}
                                    onClick={() => open(item)}
                                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    disabled={
                                      busy ||
                                      !parent?.active ||
                                      (item.active && item.in_use)
                                    }
                                    title={t(
                                      item.active ? "Deactivate" : "Activate",
                                    )}
                                    onClick={() =>
                                      setConfirm({
                                        title: t("Update subcategory status"),
                                        message: t(
                                          "Update subcategory status?",
                                        ),
                                        action: () =>
                                          saveIngredientSubcategory(
                                            categoryID,
                                            {
                                              name: item.name,
                                              active: !item.active,
                                            },
                                            item.subcategory_ingredient_id,
                                          ).then(() => {}),
                                      })
                                    }
                                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                                  >
                                    <Power size={16} />
                                  </button>
                                </>
                              )}
                              {canDelete && (
                                <button
                                  disabled={busy || item.in_use}
                                  title={t("Delete subcategory")}
                                  onClick={() =>
                                    setConfirm({
                                      title: t("Delete subcategory"),
                                      tone: "danger",
                                      message: t(
                                        "Delete this subcategory permanently?",
                                      ),
                                      action: () =>
                                        deleteIngredientSubcategory(
                                          categoryID,
                                          item.subcategory_ingredient_id,
                                        ).then(() => {}),
                                    })
                                  }
                                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4 text-xs text-stone-500">
              <div className="flex items-center gap-4">
                <p>
                  {t("Page")} {page} {t("of")} {totalPages}
                </p>
                <label>
                  {t("Limit")}{" "}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-lg border p-2"
                  >
                    {[10, 20, 30, 40, 50].map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                >
                  {t("Previous")}
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                >
                  {t("Next")}
                </button>
              </div>
            </footer>
          </div>
        </main>
      </section>
      <NameFormDialog
        open={modal}
        title={t(editing ? "Edit subcategory" : "Add subcategory")}
        name={name}
        onNameChange={setName}
        onSubmit={submit}
        onClose={() => setModal(false)}
        submitting={saving}
        nameError={nameError}
        error={error}
      />
      {detailOpen && importDetails && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-bold">{t("Import detail")}</h2>
              <button onClick={() => setDetailOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="overflow-auto p-5">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    {["Row", "Name", "Status", "Reason"].map((label) => (
                      <th key={label} className="p-3">
                        {t(label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importDetails.map((detail) => (
                    <tr key={detail.row} className="border-b border-stone-100">
                      <td className="p-3">{detail.row}</td>
                      <td className="p-3">{detail.name || "-"}</td>
                      <td className="p-3">
                        <span
                          className={
                            detail.status === "success"
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {t(
                            detail.status === "success" ? "Success" : "Failed",
                          )}
                        </span>
                      </td>
                      <td className="p-3">{detail.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t p-5">
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                {t("Close")}
              </button>
            </footer>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmText={confirm?.confirmText ?? t("Confirm")}
        tone={confirm?.tone}
        submitting={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void (modal ? confirm.action() : run(confirm.action));
        }}
      />
    </div>
  );
}

export default IngredientSubcategoriesPage;
