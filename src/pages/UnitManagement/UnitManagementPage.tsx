import { Download, Pencil, Plus, Power, Ruler, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { isAxiosError } from "axios";
import * as XLSX from "xlsx-js-style";
import {
  createUnit,
  deleteUnit,
  getUnits,
  updateUnit,
  type Unit,
  type UnitPayload,
} from "../../api/unit.api";
import { getUnitUsage } from "../../api/ingredient.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const emptyForm: UnitPayload = {
  code: "",
  name: "",
  unit_type: "",
  active: true,
};

type ImportStatus = "success" | "failed";

interface ImportDetail {
  row: number;
  code: string;
  name: string;
  unitType: string;
  status: ImportStatus;
  reason: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  details: ImportDetail[];
}

export default function UnitManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canCreateUnits = userCan(user, "units", "create");
  const canUpdateUnits = userCan(user, "units", "update");
  const canDeleteUnits = userCan(user, "units", "delete");
  const showActions = canUpdateUnits || canDeleteUnits;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitUsage, setUnitUsage] = useState<Record<string, boolean>>({});
  const [selectedUnitIDs, setSelectedUnitIDs] = useState<string[]>([]);
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
          const usage = await getUnitUsage(
            nextUnits.map((unit) => unit.unit_id),
          );
          if (!current) return;
          const nextUsage = usage.data ?? {};
          setUnitUsage(nextUsage);
          setSelectedUnitIDs((currentIDs) =>
            currentIDs.filter((unitID) =>
              nextUnits.some((unit) => unit.unit_id === unitID) &&
              !nextUsage[unitID],
            ),
          );
        } else {
          setUnitUsage({});
          setSelectedUnitIDs([]);
        }
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setUnits([]);
        setUnitUsage({});
        setSelectedUnitIDs([]);
        setError(response?.message || t("Could not load units."));
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
      setFieldErrors({ code: t("all fields are required") });
      return;
    }
    setConfirm({
      title: editingUnit ? t("Update unit") : t("Create unit"),
      message: editingUnit ? t("Update this unit?") : t("Create this unit?"),
      confirmText: editingUnit ? t("Update unit") : t("Create unit"),
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
      setActionError(response?.valid ? "" : response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(unit: Unit) {
    if (unitUsage[unit.unit_id]) return;
    setConfirm({
      title: t("Delete unit"),
      message: t("Delete this unit permanently?"),
      confirmText: t("Delete unit"),
      tone: "danger",
      onConfirm: () => deleteConfirmed(unit.unit_id),
    });
  }

  async function deleteConfirmed(unitID: string) {
    setConfirm(null);
    setSubmitting(true);
    try {
      await deleteUnit(unitID);
      setSelectedUnitIDs((currentIDs) =>
        currentIDs.filter((selectedID) => selectedID !== unitID),
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete unit."));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelectUnit(unit: Unit) {
    if (unitUsage[unit.unit_id]) return;
    setSelectedUnitIDs((currentIDs) =>
      currentIDs.includes(unit.unit_id)
        ? currentIDs.filter((unitID) => unitID !== unit.unit_id)
        : [...currentIDs, unit.unit_id],
    );
  }

  function toggleSelectAllAvailable() {
    if (selectableUnits.length === 0) return;
    if (allSelectableChecked) {
      setSelectedUnitIDs((currentIDs) =>
        currentIDs.filter(
          (unitID) => !selectableUnits.some((unit) => unit.unit_id === unitID),
        ),
      );
      return;
    }
    setSelectedUnitIDs((currentIDs) => {
      const nextIDs = new Set(currentIDs);
      selectableUnits.forEach((unit) => nextIDs.add(unit.unit_id));
      return Array.from(nextIDs);
    });
  }

  function requestBatchDelete() {
    if (selectedUnitIDs.length === 0) return;
    setConfirm({
      title: t("Delete selected units"),
      message: t("Delete selected units permanently?"),
      confirmText: t("Delete selected units"),
      tone: "danger",
      onConfirm: batchDeleteConfirmed,
    });
  }

  async function batchDeleteConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      await Promise.all(selectedUnitIDs.map((unitID) => deleteUnit(unitID)));
      setSelectedUnitIDs([]);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not delete selected units."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestToggleActive(unit: Unit) {
    if (unit.active && unitUsage[unit.unit_id]) return;
    setConfirm({
      title: unit.active ? t("Deactivate unit") : t("Activate unit"),
      message: unit.active
        ? t("Deactivate this unit?")
        : t("Activate this unit?"),
      confirmText: unit.active ? t("Deactivate") : t("Activate"),
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
      setError(response?.message || t("Could not update unit status."));
    } finally {
      setSubmitting(false);
    }
  }

  function writeUnitsWorkbook(exportItems: Unit[]) {
    const header = ["KODE", "NAMA", "TYPE SATUAN ISI"];
    const rows = exportItems.map((unit) => [unit.code, unit.name, unit.unit_type]);
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    worksheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 22 }];
    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:C1");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Satuan Isi");
    XLSX.writeFile(workbook, "satuan-isi.xlsx");
  }

  async function exportUnits() {
    setExporting(true);
    setError("");
    try {
      const exportItems: Unit[] = [];
      const exportLimit = 100;
      let exportStart = 0;
      let exportTotal = total;

      do {
        const response = await getUnits({
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

      writeUnitsWorkbook(exportItems);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || t("Could not export units."));
    } finally {
      setExporting(false);
    }
  }

  function getImportReason(message?: string) {
    const normalized = (message ?? "").toLowerCase().trim();
    if (normalized === "unit code already exists") {
      return t("Unit code already exists");
    }
    if (normalized === "unit name already exists") {
      return t("Unit name already exists");
    }
    if (normalized === "invalid input") {
      return t("Invalid unit input");
    }
    if (normalized === "internal server error") {
      return t("Internal server error");
    }
    return t("Import failed");
  }

  async function importUnits(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setImportSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, {
        header: 1,
        defval: "",
      });
      const details: ImportDetail[] = [];
      const seenCodes = new Set<string>();
      const seenNames = new Set<string>();
      const dataRows = rows.slice(1);

      for (const [index, row] of dataRows.entries()) {
        const rowNumber = index + 2;
        const code = String(row[0] ?? "").trim().toUpperCase();
        const name = String(row[1] ?? "").trim();
        const unitType = String(row[2] ?? "").trim();
        const normalizedName = name.toLowerCase();

        if (!code && !name && !unitType) {
          continue;
        }
        if (!code || !name || !unitType) {
          details.push({
            row: rowNumber,
            code,
            name,
            unitType,
            status: "failed",
            reason: t("Code, name, and unit type are required"),
          });
          continue;
        }
        if (seenCodes.has(code)) {
          details.push({
            row: rowNumber,
            code,
            name,
            unitType,
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
            unitType,
            status: "failed",
            reason: t("Duplicate name in import file"),
          });
          continue;
        }

        seenCodes.add(code);
        seenNames.add(normalizedName);
        try {
          await createUnit({ code, name, unit_type: unitType, active: true });
          details.push({
            row: rowNumber,
            code,
            name,
            unitType,
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
            unitType,
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
            unitType: "",
            status: "failed",
            reason: t("Could not read import file."),
          },
        ],
      });
    } finally {
      setImporting(false);
    }
  }

  const selectableUnits = useMemo(
    () => units.filter((unit) => !unitUsage[unit.unit_id]),
    [units, unitUsage],
  );
  const allSelectableChecked =
    selectableUnits.length > 0 &&
    selectableUnits.every((unit) => selectedUnitIDs.includes(unit.unit_id));
  const partiallyChecked =
    selectedUnitIDs.length > 0 && !allSelectableChecked;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 5 + (canDeleteUnits ? 1 : 0) + (showActions ? 1 : 0);
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
              <h1 className="font-serif text-3xl font-bold">{t("Unit Management")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage inventory measurement units.")}
              </p>
            </div>
            {canCreateUnits && <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              {t("Add unit")}
            </button>}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">{t("All units")}</h2>
                <p className="text-xs text-stone-500">{total} {t("units found")}</p>
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
                    placeholder={t("Search unit...")}
                  />
                </form>
                {canCreateUnits && (
                  <>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => void importUnits(event)}
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
                  onClick={() => void exportUnits()}
                  disabled={loading || exporting || total === 0}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                >
                  <Download size={16} />
                  {exporting ? t("Exporting...") : t("Export")}
                </button>
                {canDeleteUnits && (
                  <>
                    <label className="flex h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        checked={allSelectableChecked}
                        ref={(input) => {
                          if (input) input.indeterminate = partiallyChecked;
                        }}
                        onChange={toggleSelectAllAvailable}
                        disabled={loading || selectableUnits.length === 0}
                        className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                      />
                      {t("Select all")}
                    </label>
                    <button
                      type="button"
                      onClick={requestBatchDelete}
                      disabled={selectedUnitIDs.length === 0 || submitting}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={16} />
                      {t("Delete selected")} ({selectedUnitIDs.length})
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
                    {canDeleteUnits && <th className="w-12 px-5 py-3"></th>}
                    <th className="px-5 py-3">{t("Unit")}</th>
                    <th className="px-5 py-3">{t("Code")}</th>
                    <th className="px-5 py-3">{t("Type")}</th>
                    <th className="px-5 py-3">{t("Usage")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showActions && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("Loading units...")}
                      </td>
                    </tr>
                  ) : units.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-stone-500">
                        {t("No units found")}
                      </td>
                    </tr>
                  ) : (
                    units.map((unit) => {
                      const inUse = Boolean(unitUsage[unit.unit_id]);
                      return (
                      <tr key={unit.unit_id} className="hover:bg-stone-50/70">
                        {canDeleteUnits && (
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              checked={selectedUnitIDs.includes(unit.unit_id)}
                              onChange={() => toggleSelectUnit(unit)}
                              disabled={inUse}
                              className="size-4 accent-[#362219] disabled:cursor-not-allowed"
                              title={inUse ? t("Unit is used by ingredients, unit conversions, or stock movements") : t("Select unit")}
                            />
                          </td>
                        )}
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
                            {inUse ? t("Used") : t("Unused")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${unit.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                            {unit.active ? t("Active") : t("Inactive")}
                          </span>
                        </td>
                        {showActions && <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {canUpdateUnits && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openModal(unit)}
                                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                  title={t("Update unit")}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestToggleActive(unit)}
                                  disabled={unit.active && inUse}
                                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                  title={unit.active && inUse ? t("Unit is used by ingredients, unit conversions, or stock movements") : unit.active ? t("Deactivate unit") : t("Activate unit")}
                                >
                                  <Power size={15} />
                                </button>
                              </>
                            )}
                            {canDeleteUnits && (
                              <button
                                type="button"
                                onClick={() => requestDelete(unit)}
                                disabled={inUse}
                                className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                title={inUse ? t("Unit is used by ingredients, unit conversions, or stock movements") : t("Delete unit")}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
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
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitForm} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingUnit ? t("Update unit") : t("Add unit")}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {(["code", "name", "unit_type"] as const).map((field) => (
                <label key={field} className="block text-sm font-semibold text-stone-700">
                  {field === "unit_type" ? t("Unit type") : field === "code" ? t("Code") : t("Name")}
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
        <div className="fixed inset-0 z-85 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">{t("Row")}</th>
                    <th className="px-4 py-3">{t("Code")}</th>
                    <th className="px-4 py-3">{t("Name")}</th>
                    <th className="px-4 py-3">{t("Type")}</th>
                    <th className="px-4 py-3">{t("Status")}</th>
                    <th className="px-4 py-3">{t("Reason")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {importSummary.details.map((detail, index) => (
                    <tr key={`${detail.row}-${index}`}>
                      <td className="px-4 py-3 text-sm font-semibold">{detail.row || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.code || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.name || "-"}</td>
                      <td className="px-4 py-3 text-sm">{detail.unitType || "-"}</td>
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
