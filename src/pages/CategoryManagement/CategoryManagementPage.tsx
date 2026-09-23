import { FolderTree, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type Category,
  type CategoryPayload,
} from "../../api/category.api";
import { getProductCategoryUsage } from "../../api/product.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: CategoryPayload = {
  name: "",
  description: "",
  active: true,
};

export default function CategoryManagementPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryUsage, setCategoryUsage] = useState<Record<string, boolean>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
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
    async function loadCategories() {
      setLoading(true);
      setError("");
      try {
        const response = await getCategories({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextCategories = response.data ?? [];
        setCategories(nextCategories);
        setTotal(response.total ?? 0);
        if (nextCategories.length > 0) {
          const usage = await getProductCategoryUsage(
            nextCategories.map((category) => category.category_id),
          );
          if (!current) return;
          setCategoryUsage(usage.data ?? {});
        } else {
          setCategoryUsage({});
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setCategories([]);
        setCategoryUsage({});
        setTotal(0);
        setError(response?.message || "Could not load categories.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCategories();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey]);

  function openModal(category?: Category) {
    setEditingCategory(category ?? null);
    setForm(
      category
        ? {
            name: category.name,
            description: category.description,
            active: category.active,
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
      setFieldErrors({ name: "required" });
      return;
    }
    setConfirm({
      title: editingCategory ? "Update category" : "Create category",
      message: editingCategory ? "Update this category?" : "Create this category?",
      confirmText: editingCategory ? "Update category" : "Create category",
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.category_id, form);
      } else {
        await createCategory(form);
      }
      setModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string; valid?: Record<string, string> }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(category: Category) {
    if (category.active && categoryUsage[category.category_id]) return;
    setConfirm({
      title: category.active ? "Deactivate category" : "Activate category",
      message: category.active ? "Deactivate this category?" : "Activate this category?",
      confirmText: category.active ? "Deactivate" : "Activate",
      onConfirm: () => toggleActiveConfirmed(category),
    });
  }

  async function toggleActiveConfirmed(category: Category) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateCategory(category.category_id, {
        name: category.name,
        description: category.description,
        active: !category.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not update category status.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(category: Category) {
    if (categoryUsage[category.category_id]) return;
    setConfirm({
      title: "Delete category",
      message: "Delete this category permanently?",
      confirmText: "Delete category",
      tone: "danger",
      onConfirm: () => deleteConfirmed(category.category_id),
    });
  }

  async function deleteConfirmed(categoryID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteCategory(categoryID);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not delete category.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#ece8f0] text-[#675179]">
                <FolderTree size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">Category Management</h1>
              <p className="mt-2 text-sm text-stone-500">Manage inventory product categories.</p>
            </div>
            <button type="button" onClick={() => openModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
              <Plus size={17} />
              Add category
            </button>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">All categories</h2>
                <p className="text-xs text-stone-500">{total} categories found</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
                className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10"
              >
                <Search size={17} className="text-stone-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search category..." />
              </form>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Usage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">Loading categories...</td></tr>
                  ) : categories.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">No categories found</td></tr>
                  ) : (
                    categories.map((category) => {
                      const inUse = Boolean(categoryUsage[category.category_id]);
                      return (
                      <tr key={category.category_id} onClick={() => navigate(`/category-management/${category.category_id}`)} className="cursor-pointer hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold">{category.name}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-600">{category.description || "-"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                            <span className={`size-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-stone-400"}`} />
                            {inUse ? "Used" : "Unused"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {category.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={(event) => { event.stopPropagation(); openModal(category); }} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title="Update category"><Pencil size={15} /></button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); requestToggleActive(category); }} disabled={category.active && inUse} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={category.active && inUse ? "Category is used by products" : category.active ? "Deactivate category" : "Activate category"}><Power size={15} /></button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); requestDelete(category); }} disabled={inUse} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={inUse ? "Category is used by products" : "Delete category"}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">Page {page} of {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  Limit
                  <select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10">
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
              </div>
            </footer>
          </section>
        </main>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingCategory ? "Update category" : "Add category"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Name
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.name && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.name}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Description
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.description && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.description}</p>}
              </label>
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
