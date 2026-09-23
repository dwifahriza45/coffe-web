import { ArrowLeft, CupSoda, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCategory, type Category } from "../../api/category.api";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  type Product,
  type ProductPayload,
} from "../../api/product.api";
import { getProductRecipeUsage } from "../../api/recipe.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: ProductPayload = {
  category_id: "",
  name: "",
  description: "",
  price: "",
  image_url: "",
  active: true,
};

function formatPrice(value: string) {
  return formatNumber(value, 2);
}

export default function CategoryDetailPage() {
  const { categoryID = "" } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productUsage, setProductUsage] = useState<Record<string, boolean>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm, category_id: categoryID });
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
    async function loadCategoryProducts() {
      setLoading(true);
      setError("");
      try {
        const [categoryResponse, productResponse] = await Promise.all([
          getCategory(categoryID),
          getProducts({
            start: (page - 1) * pageSize,
            limit: pageSize,
            name: search,
            category_id: categoryID,
          }),
        ]);
        if (!current) return;
        const nextProducts = productResponse.data ?? [];
        setCategory(categoryResponse.data ?? null);
        setProducts(nextProducts);
        setTotal(productResponse.total ?? 0);
        if (nextProducts.length > 0) {
          const usage = await getProductRecipeUsage(
            nextProducts.map((product) => product.product_id),
          );
          if (!current) return;
          setProductUsage(usage.data ?? {});
        } else {
          setProductUsage({});
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setProducts([]);
        setProductUsage({});
        setTotal(0);
        setError(response?.message || "Could not load category detail.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCategoryProducts();
    return () => {
      current = false;
    };
  }, [categoryID, page, pageSize, search, refreshKey]);

  function openModal(product?: Product) {
    setEditingProduct(product ?? null);
    setForm(
      product
        ? {
            category_id: categoryID,
            name: product.name,
            description: product.description,
            price: product.price,
            image_url: product.image_url,
            active: product.active,
          }
        : { ...emptyForm, category_id: categoryID },
    );
    setFieldErrors({});
    setActionError("");
    setModalOpen(true);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (!form.name.trim() || !form.price) {
      setFieldErrors({
        name: !form.name.trim() ? "name is required" : "",
        price: !form.price ? "price is required" : "",
      });
      return;
    }
    setConfirm({
      title: editingProduct ? "Update product" : "Create product",
      message: editingProduct ? "Update this product?" : "Create this product?",
      confirmText: editingProduct ? "Update product" : "Create product",
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.product_id, form);
      } else {
        await createProduct(form);
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

  function requestToggleActive(product: Product) {
    if (product.active && productUsage[product.product_id]) return;
    setConfirm({
      title: product.active ? "Deactivate product" : "Activate product",
      message: product.active ? "Deactivate this product?" : "Activate this product?",
      confirmText: product.active ? "Deactivate" : "Activate",
      onConfirm: () => toggleActiveConfirmed(product),
    });
  }

  async function toggleActiveConfirmed(product: Product) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateProduct(product.product_id, {
        category_id: categoryID,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        active: !product.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not update product status.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(product: Product) {
    if (productUsage[product.product_id]) return;
    setConfirm({
      title: "Delete product",
      message: "Delete this product permanently?",
      confirmText: "Delete product",
      tone: "danger",
      onConfirm: () => deleteConfirmed(product.product_id),
    });
  }

  async function deleteConfirmed(productID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteProduct(productID);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not delete product.");
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
          <Link to="/category-management" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={16} />
            Category Management
          </Link>
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <CupSoda size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{category?.name ?? "Category Detail"}</h1>
              <p className="mt-2 text-sm text-stone-500">{category?.description || "Products in this category"}</p>
            </div>
            <button type="button" onClick={() => openModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
              <Plus size={17} />
              Add product
            </button>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Products</h2>
                <p className="text-xs text-stone-500">{total} products found</p>
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
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search product..." />
              </form>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Usage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">Loading products...</td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-stone-500">No products found</td></tr>
                  ) : (
                    products.map((product) => {
                      const inUse = Boolean(productUsage[product.product_id]);
                      return (
                        <tr key={product.product_id} onClick={() => navigate(`/category-management/${categoryID}/products/${product.product_id}`)} className="cursor-pointer hover:bg-stone-50/70">
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold">{product.name}</p>
                            {product.description && <p className="mt-1 max-w-xs truncate text-xs text-stone-500">{product.description}</p>}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold">{formatPrice(product.price)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                              {inUse ? "Used" : "Unused"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                              {product.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1.5">
                              <button type="button" onClick={(event) => { event.stopPropagation(); openModal(product); }} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title="Update product"><Pencil size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); requestToggleActive(product); }} disabled={product.active && inUse} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={product.active && inUse ? "Product is used by recipes" : product.active ? "Deactivate product" : "Activate product"}><Power size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); requestDelete(product); }} disabled={inUse} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent" title={inUse ? "Product is used by recipes" : "Delete product"}><Trash2 size={15} /></button>
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
              <h2 className="text-lg font-bold">{editingProduct ? "Update product" : "Add product"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Name
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.name && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.name}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Price
                <input inputMode="decimal" placeholder="0" value={formatPrice(form.price)} onChange={(event) => setForm((current) => ({ ...current, price: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.price && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.price}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Image URL
                <input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.image_url && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.image_url}</p>}
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
