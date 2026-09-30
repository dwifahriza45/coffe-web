import { Pencil, Plus, Power, Truck, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierPayload,
} from "../../api/supplier.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: SupplierPayload = {
  name: "",
  phone: "",
  email: "",
  address: "",
  active: true,
};

export default function SupplierManagementPage() {
  const { user } = useAuth();
  const canCreateSuppliers = userCan(user, "suppliers", "create");
  const canUpdateSuppliers = userCan(user, "suppliers", "update");
  const canDeleteSuppliers = userCan(user, "suppliers", "delete");
  const showActions = canUpdateSuppliers || canDeleteSuppliers;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setSuppliers([]);
        setError(response?.message || "Could not load suppliers.");
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
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
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
      setFieldErrors({ name: "Name is required" });
      return;
    }
    setConfirm({
      title: editingSupplier ? "Update supplier" : "Create supplier",
      message: editingSupplier ? "Update this supplier?" : "Create this supplier?",
      confirmText: editingSupplier ? "Update supplier" : "Create supplier",
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
      setNotice("Supplier saved successfully.");
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
      setActionError(response?.valid ? "" : response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(supplier: Supplier) {
    if (!canDeleteSuppliers || submitting) return;
    setConfirm({
      title: "Delete supplier",
      message: "Delete this supplier permanently?",
      confirmText: "Delete supplier",
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
      setNotice("Supplier deleted successfully.");
      if (suppliers.length === 1 && page > 1) setPage((value) => value - 1);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not delete supplier.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(supplier: Supplier) {
    if (!canUpdateSuppliers || submitting) return;
    setConfirm({
      title: supplier.active ? "Deactivate supplier" : "Activate supplier",
      message: supplier.active
        ? "Deactivate this supplier?"
        : "Activate this supplier?",
      confirmText: supplier.active ? "Deactivate" : "Activate",
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
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        active: !supplier.active,
      });
      setNotice("Supplier status updated successfully.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not update supplier status.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = showActions ? 6 : 5;
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
              <h1 className="font-serif text-3xl font-bold">Suppliers</h1>
              <p className="mt-2 text-sm text-stone-500">
                Manage supplier contacts and availability.
              </p>
            </div>
            {canCreateSuppliers && <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              Add supplier
            </button>}
          </header>

          {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">All suppliers</h2>
                <p className="text-xs text-stone-500">{total} suppliers found</p>
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
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Search supplier..."
                />
              </form>
            </div>
            {error && (
              <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Address</th>
                    <th className="px-5 py-3">Status</th>
                    {showActions && <th className="px-5 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        No suppliers found
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => {
                      return (
                      <tr key={supplier.supplier_id} className="hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold">{supplier.name}</p>
                          <p className="mt-1 text-xs text-stone-500">{supplier.supplier_id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm">{supplier.phone || "-"}</td>
                        <td className="px-5 py-4 text-sm">{supplier.email || "-"}</td>
                        <td className="max-w-xs whitespace-pre-wrap break-words px-5 py-4 text-sm">{supplier.address || "-"}</td>

                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${supplier.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {supplier.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {showActions && <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {canUpdateSuppliers && <button
                              type="button"
                              onClick={() => openModal(supplier)}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                              title="Update supplier"
                            >
                              <Pencil size={15} />
                            </button>}
                            {canUpdateSuppliers && <button
                              type="button"
                              onClick={() => requestToggleActive(supplier)}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title={supplier.active ? "Deactivate supplier" : "Activate supplier"}
                            >
                              <Power size={15} />
                            </button>}
                            {canDeleteSuppliers && <button
                              type="button"
                              onClick={() => requestDelete(supplier)}
                              className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title="Delete supplier"
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
                  Page {page} of {totalPages}
                </p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  Limit
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
                  Previous
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Next
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
              <h2 className="text-lg font-bold">{editingSupplier ? "Update supplier" : "Add supplier"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {(["name", "phone", "email", "address"] as const).map((field) => (
                <label key={field} className="block text-sm font-semibold text-stone-700">
                  {({ name: "Name", phone: "Phone", email: "Email", address: "Address" })[field]}{field === "name" ? " *" : ""}
                  <input
                    type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    required={field === "name"}
                    minLength={field === "name" ? 2 : undefined}
                    maxLength={({ name: 120, phone: 30, email: 254, address: 1000 })[field]}
                    value={form[field]}
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
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? "Saving..." : "Save"}
              </button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText ?? "Confirm"}
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
