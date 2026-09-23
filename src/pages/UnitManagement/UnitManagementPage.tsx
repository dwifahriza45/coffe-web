import { Pencil, Plus, Power, Ruler, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  createUnit,
  deleteUnit,
  getUnits,
  updateUnit,
  type Unit,
  type UnitPayload,
} from "../../api/unit.api";
import { getIngredientUnitUsage } from "../../api/ingredient.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: UnitPayload = {
  code: "",
  name: "",
  unit_type: "",
  active: true,
};

export default function UnitManagementPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitUsage, setUnitUsage] = useState<Record<string, boolean>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
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
    async function loadUnits() {
      setLoading(true);
      setError("");
      try {
        const response = await getUnits({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
        });
        if (!current) return;
        const nextUnits = response.data ?? [];
        setUnits(nextUnits);
        setTotal(response.total ?? 0);
        if (nextUnits.length > 0) {
          const usage = await getIngredientUnitUsage(
            nextUnits.map((unit) => unit.unit_id),
          );
          if (!current) return;
          setUnitUsage(usage.data ?? {});
        } else {
          setUnitUsage({});
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setUnits([]);
        setUnitUsage({});
        setError(response?.message || "Could not load units.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadUnits();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey]);

  function openModal(unit?: Unit) {
    setEditingUnit(unit ?? null);
    setForm(
      unit
        ? {
            code: unit.code,
            name: unit.name,
            unit_type: unit.unit_type,
            active: unit.active,
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
    if (!form.code.trim() || !form.name.trim() || !form.unit_type.trim()) {
      setFieldErrors({ code: "all fields are required" });
      return;
    }
    setConfirm({
      title: editingUnit ? "Update unit" : "Create unit",
      message: editingUnit ? "Update this unit?" : "Create this unit?",
      confirmText: editingUnit ? "Update unit" : "Create unit",
      onConfirm: submitConfirmed,
    });
  }

  async function submitConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.unit_id, form);
      } else {
        await createUnit(form);
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
      setActionError(response?.valid ? "" : response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(unit: Unit) {
    if (unitUsage[unit.unit_id]) return;
    setConfirm({
      title: "Delete unit",
      message: "Delete this unit permanently?",
      confirmText: "Delete unit",
      tone: "danger",
      onConfirm: () => deleteConfirmed(unit.unit_id),
    });
  }

  async function deleteConfirmed(unitID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteUnit(unitID);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not delete unit.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(unit: Unit) {
    if (unit.active && unitUsage[unit.unit_id]) return;
    setConfirm({
      title: unit.active ? "Deactivate unit" : "Activate unit",
      message: unit.active
        ? "Deactivate this unit?"
        : "Activate this unit?",
      confirmText: unit.active ? "Deactivate" : "Activate",
      onConfirm: () => toggleActiveConfirmed(unit),
    });
  }

  async function toggleActiveConfirmed(unit: Unit) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await updateUnit(unit.unit_id, {
        code: unit.code,
        name: unit.name,
        unit_type: unit.unit_type,
        active: !unit.active,
      });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not update unit status.");
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
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <Ruler size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">Unit Management</h1>
              <p className="mt-2 text-sm text-stone-500">
                Manage inventory measurement units.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              Add unit
            </button>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">All units</h2>
                <p className="text-xs text-stone-500">{total} units found</p>
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
                  placeholder="Search unit..."
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
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Usage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-stone-500">
                        Loading units...
                      </td>
                    </tr>
                  ) : units.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-stone-500">
                        No units found
                      </td>
                    </tr>
                  ) : (
                    units.map((unit) => {
                      const inUse = Boolean(unitUsage[unit.unit_id]);
                      return (
                      <tr key={unit.unit_id} className="hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold">{unit.name}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold">
                          {unit.code}
                        </td>
                        <td className="px-5 py-4 text-sm">{unit.unit_type}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                            <span className={`size-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-stone-400"}`} />
                            {inUse ? "Used" : "Unused"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${unit.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {unit.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal(unit)}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                              title="Update unit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestToggleActive(unit)}
                              disabled={unit.active && inUse}
                              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title={unit.active && inUse ? "Unit is used by ingredients" : unit.active ? "Deactivate unit" : "Activate unit"}
                            >
                              <Power size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(unit)}
                              disabled={inUse}
                              className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title={inUse ? "Unit is used by ingredients" : "Delete unit"}
                            >
                              <Trash2 size={15} />
                            </button>
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
          <form onSubmit={submitForm} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingUnit ? "Update unit" : "Add unit"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {(["code", "name", "unit_type"] as const).map((field) => (
                <label key={field} className="block text-sm font-semibold text-stone-700">
                  {field === "unit_type" ? "Unit type" : field === "code" ? "Code" : "Name"}
                  <input
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
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
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
