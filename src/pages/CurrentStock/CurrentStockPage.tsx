import { useAuth } from "../../app/AuthContext";
import { userCanStockDepartment } from "../../app/roleAccess";
import { stockCountDepartments, matchesStockCountDepartment } from "../../utils/stockCountDepartment";
import InventoryCategoryFilters from "../../components/common/InventoryCategoryFilters";
import CurrentStockCharts from "../../components/common/CurrentStockCharts";
import { getAllCategoryIngredients, getIngredientSubcategories, type CategoryIngredient, type IngredientSubcategory } from "../../api/categoryIngredient.api";
import { getStockSnapshot } from "../../api/currentStock.api";
import StockDateFilter from "../../components/common/StockDateFilter";
import { inventorySectionLabel, stockDisplayUnits } from "../../utils/stockDisplay";
import { Bean, Boxes, Download, LayoutGrid, List, Package, RefreshCw, Search } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { createExportWorksheet } from "../../utils/exportWorksheet";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getIngredients, getStockItemMetadata, type StockItemMetadata, type Ingredient } from "../../api/ingredient.api";
import { useLanguage } from "../../app/LanguageContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { currentBusinessDate } from "../../utils/businessDate";
import { formatNumber } from "../../utils/numberFormat";

type CurrentStockRow = {
  ingredient: Ingredient;
  current: number;
  known: boolean;
  metadata?: StockItemMetadata;
  unitPrice: number | null;
};

function toNumber(value?: string) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: number, unit?: string) {
  return `${formatNumber(String(value), 3)}${unit ? ` ${unit}` : ""}`;
}

export default function CurrentStockPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const allowedDepartments = stockCountDepartments.filter(part => userCanStockDepartment(user, part.key));
  const departmentKeys = allowedDepartments.map(part => part.key).join(",");

  const [searchParams] = useSearchParams();
  const [view,setView]=useState<"list" | "grid">(() => {try {return localStorage.getItem("coffee-current-stock-view")==="grid" ? "grid" : "list";} catch {return "list";}});
  function changeView(next: "list" | "grid") {setView(next);try {localStorage.setItem("coffee-current-stock-view",next);} catch { /* View selection still works when storage is unavailable. */ }}
  const [displayUnits, setDisplayUnits] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const date = searchParams.get("date") || currentBusinessDate();
  const historical = date !== currentBusinessDate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categories,setCategories]=useState<CategoryIngredient[]>([]);
  const allowedCategories = categories.filter(category => allowedDepartments.some(part => matchesStockCountDepartment(category.name, part.key)));
  const [subcategories,setSubcategories]=useState<IngredientSubcategory[]>([]);
  const [categoryFilter,setCategoryFilter]=useState("");
  const [subcategoryFilter,setSubcategoryFilter]=useState("");
  const [supplierFilter,setSupplierFilter]=useState("");
  const [rows, setRows] = useState<CurrentStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let current = true;
    async function loadCurrentStock() {
      setLoading(true);
      setError("");
      try {
        async function allPages<T>(load: (start: number) => Promise<{data?: T[] | null; total?: number}>) {
          const data: T[]=[];
          for (;;) { const response=await load(data.length); const next=response.data ?? []; data.push(...next); if (!next.length || data.length >= (response.total ?? data.length)) return {data}; }
        }
        const [ingredientResponse, snapshotResponse, metadataResponse, categoryResponse, subcategoryResponse] = await Promise.all([
          allPages((start) => getIngredients({start,limit:100,name:""})),
          getStockSnapshot(date), getStockItemMetadata(), getAllCategoryIngredients(), getIngredientSubcategories(),
        ]);
        if (!current) return;
        setCategories(categoryResponse);
        setSubcategories(subcategoryResponse.data ?? []);
        const metadataByID = new Map((metadataResponse.data ?? []).map(item => [item.ingredient_id, item]));
        const snapshotByID = new Map((snapshotResponse.data?.items ?? []).map(item => [item.ingredient_id, item]));
        const ingredients = (ingredientResponse.data ?? []).filter(ingredient => snapshotByID.has(ingredient.ingredient_id) && (historical || ingredient.active));
        setRows(
          ingredients.map((ingredient) => {
            const snapshot = snapshotByID.get(ingredient.ingredient_id)!;
            const metadata = metadataByID.get(ingredient.ingredient_id);
            return {
              ingredient: historical ? { ...ingredient, minimum_stock: snapshot.minimum_stock ?? "", target_stock: snapshot.target_stock ?? "", content_qty: snapshot.content_qty ?? "", package_qty: snapshot.package_qty ?? "" } : ingredient,
              current: toNumber(snapshot.current_quantity ?? ""), known: snapshot.current_quantity !== null,
              metadata: historical && metadata ? { ...metadata, packaging: snapshot.packaging ?? "", content_unit: snapshot.content_unit ?? "" } : metadata,
              unitPrice: historical ? snapshot.unit_price === null ? null : toNumber(snapshot.unit_price) : metadata?.unit_price != null ? toNumber(metadata.unit_price) : snapshot.unit_price === null ? null : toNumber(snapshot.unit_price),
            };
          }),
        );
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setRows([]);
        setError(response?.message || t("Could not load current stock."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadCurrentStock();
    return () => {
      current = false;
    };
  }, [date, refresh, t]);

  useEffect(() => {
    const permitted = categories.filter(category => departmentKeys.split(",").some(key => key && matchesStockCountDepartment(category.name,key)));
    setCategoryFilter(previous => permitted.length === 1 ? permitted[0].category_ingredient_id : permitted.some(category => category.category_ingredient_id === previous) ? previous : "");
    setSubcategoryFilter("");
  }, [departmentKeys, categories]);

  const searchedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const scopedRows=rows.filter(row => departmentKeys.split(",").some(key => key && matchesStockCountDepartment(row.ingredient.category_ingredient_name,key)));
    const suppliedRows=supplierFilter ? scopedRows.filter((row) => row.ingredient.supplier_id===supplierFilter) : scopedRows;
    if (!keyword) return suppliedRows;
    return suppliedRows.filter((row) =>
      [row.ingredient.name, row.ingredient.ingredient_id, row.ingredient.category_ingredient_name, row.metadata?.brand, row.metadata?.subcategory, row.metadata?.supplier].filter(Boolean).join(" ").toLowerCase().includes(keyword),
    );
  }, [rows, search, supplierFilter, departmentKeys]);

  const visibleRows = useMemo(() => searchedRows.filter(({ingredient}) => (!categoryFilter || ingredient.category_ingredient_id===categoryFilter) && (!subcategoryFilter || ingredient.subcategory_ingredient_id===subcategoryFilter)),[searchedRows,categoryFilter,subcategoryFilter]);
  const categoryCounts=useMemo(() => {
   const counts: Record<string,number>={};
   for (const row of searchedRows) counts[row.ingredient.category_ingredient_id]=(counts[row.ingredient.category_ingredient_id] ?? 0)+1;
   return counts;
  },[searchedRows]);
  const suppliers=useMemo(() => Array.from(new Map(rows.filter((row) => row.ingredient.supplier_id).map((row) => [row.ingredient.supplier_id,{id:row.ingredient.supplier_id,name:row.metadata?.supplier || row.ingredient.supplier_id}])).values()).sort((a,b) => a.name.localeCompare(b.name)),[rows]);

  const displayRows=useMemo(() => visibleRows.map(({ingredient,current,known,metadata,unitPrice}) => {
                    const minimum=toNumber(ingredient.minimum_stock);
                    const target=toNumber(ingredient.target_stock);
                    const out=known && current<=0;
                    const low=known && !out && current<minimum;
                    const base=ingredient.base_unit_info?.code ?? ingredient.base_unit;
                    const choices=stockDisplayUnits(base,metadata?.packaging ?? "",metadata?.content_unit ?? "",toNumber(ingredient.content_qty),toNumber(ingredient.package_qty));
                    const choice=choices.find((option) => option.key===displayUnits[ingredient.ingredient_id]) ?? choices[0];
                    const progress=minimum>0 ? Math.max(0,Math.min(100,current/minimum*100)) : current>0 ? 100 : 0;
                    const section=inventorySectionLabel(ingredient.category_ingredient_name);
                    const Icon=section === "Barista" ? Bean : Package;
                    const packagingInfo=metadata?.packaging && metadata.content_unit ? `${formatQuantity(toNumber(ingredient.package_qty),metadata.packaging)} = ${formatQuantity(toNumber(ingredient.content_qty),metadata.content_unit)}` : "";
                    const stockValue=unitPrice===null || !known ? "" : `Rp ${formatNumber(String(current*unitPrice),0)}`;

    return {ingredient,current,known,metadata,unitPrice,minimum,target,out,low,choices,choice,progress,section,Icon,packagingInfo,stockValue};
  }),[visibleRows,displayUnits]);

  function exportCurrentStock() {
    if (loading || exporting || !displayRows.length) return;
    setExporting(true);
    try {
      const headers = ["Tanggal", "Kode item", "Item", "Bagian", "Kategori", "Subkategori", "Brand / Type", "Supplier", "Stok saat ini", "Minimum stok", "Target stok", "Satuan stok", "Jumlah kemasan", "Satuan kemasan", "Jumlah isi", "Satuan isi", "Harga per satuan stok (Rp)", "Nilai stok (Rp)", "Status"];
      const exportRows = displayRows.map(({ingredient,current,known,metadata,unitPrice,minimum,target,out,low,choice,section}) => [
        date, ingredient.ingredient_id, ingredient.name, section, ingredient.category_ingredient_name,
        metadata?.subcategory ?? "", metadata?.brand ?? "", metadata?.supplier ?? "",
        known ? current / choice.divisor : null, ingredient.minimum_stock ? minimum / choice.divisor : null, target > 0 ? target / choice.divisor : null, choice.label,
        ingredient.package_qty ? toNumber(ingredient.package_qty) : null, metadata?.packaging ?? "", ingredient.content_qty ? toNumber(ingredient.content_qty) : null, metadata?.content_unit ?? "",
        unitPrice === null ? null : unitPrice * choice.divisor, unitPrice === null || !known ? null : current * unitPrice,
        !known ? "Stok belum diketahui" : t(out ? "Out of stock" : low ? "Low stock" : "In stock"),
      ]);
      const sheet = createExportWorksheet(headers, exportRows, [16, 26, 30, 18, 22, 24, 24, 24, 20, 18, 18, 18, 18, 20, 18, 18, 28, 24, 22]);
      for (let row = 1; row <= exportRows.length; row++) {
        for (const column of [8, 9, 10, 12, 14, 16, 17]) {
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
          if (cell?.t === "n") {
            const value = Number(cell.v);
            const rounded = Math.round(value * 1e6) / 1e6;
            const fractionDigits = Number.isInteger(rounded) ? 0 : (rounded.toFixed(6).replace(/0+$/, "").split(".")[1]?.length ?? 0);
            cell.z = fractionDigits ? `#,##0.${"0".repeat(fractionDigits)}` : "#,##0";
          }
        }
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Stok Saat Ini");
      const filterSheet = createExportWorksheet(["Filter", "Pilihan"], [
        ["Tanggal", date],
        ["Bagian", categories.find((category) => category.category_ingredient_id === categoryFilter)?.name ?? "Semua bagian"],
        ["Subkategori", subcategories.find((subcategory) => subcategory.subcategory_ingredient_id === subcategoryFilter)?.name ?? "Semua subkategori"],
        ["Supplier", suppliers.find((supplier) => supplier.id === supplierFilter)?.name ?? "Semua supplier"],
        ["Pencarian", search || "—"],
        ["Jumlah item", exportRows.length],
        ["Satuan", "Mengikuti pilihan satuan masing-masing item di layar."],
        ["Harga / nilai kosong", "Belum tersedia harga yang sesuai untuk tanggal dan satuan item."],
      ], [24, 85]);
      XLSX.utils.book_append_sheet(workbook, filterSheet, "Informasi Export");
      XLSX.writeFile(workbook, `stok-saat-ini-${date}.xlsx`);
    } catch {
      setError(t("Could not export current stock."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]">
                <Boxes size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{historical ? "Riwayat stok" : t("Current Stock")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {historical ? `Posisi stok akhir ${date}. Angka stok, grafik, dan ekspor mengikuti tanggal ini.` : t("Current quantity from opening stock and submitted stock movements.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              <RefreshCw size={16} />
              {t("Refresh")}
            </button>
          </header>

          <div className="mt-5"><StockDateFilter /></div>
          {historical && <p className="mt-2 text-xs text-stone-500">Harga, minimum, target, dan konversi memakai snapshot stock count yang tersedia; data yang belum direkam ditampilkan kosong. Nama dan kategori item mengikuti master saat ini.</p>}
          <InventoryCategoryFilters hideAllSections categories={allowedCategories} subcategories={subcategories} category={categoryFilter} subcategory={subcategoryFilter} counts={categoryCounts} total={loading ? null : searchedRows.length} onCategory={(id) => {setCategoryFilter(id);setSubcategoryFilter("");}} onSubcategory={setSubcategoryFilter} />

          {!loading && displayRows.some(row => !row.known) && <p className="mt-3 text-xs text-amber-800">{displayRows.filter(row => !row.known).length} item belum memiliki stok yang bisa dihitung pada tanggal ini; item tersebut tidak masuk grafik.</p>}
          <CurrentStockCharts rows={displayRows.filter(row => row.known)} loading={loading} />

          <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex justify-end px-4 pt-4">
                <div className="inline-flex rounded-full bg-[var(--color-brand-soft)] p-1" role="group" aria-label={t("View mode")}>
                  {(["list","grid"] as const).map((mode) => {const Icon=mode === "list" ? List : LayoutGrid;return <button key={mode} type="button" aria-pressed={view===mode} onClick={() => changeView(mode)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${view===mode ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-cream)]" : "text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-sage)]"}`}><Icon size={14} />{t(mode === "list" ? "List" : "Grid")}</button>;})}
                </div>
            </div>
            <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-stone-500">
                {visibleRows.length} {t("items")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportCurrentStock} disabled={loading || exporting || !displayRows.length || Boolean(error)} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-brand-primary disabled:opacity-40">
                  <Download size={16} />{t(exporting ? "Exporting..." : "Export")}
                </button>
                <select aria-label={t("Supplier")} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                  <option value="">{t("All suppliers")}</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2"
                >
                  <Search size={16} className="text-stone-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t("Search item...")}
                    className="min-w-0 bg-transparent text-sm outline-none"
                  />
                </form>
              </div>
            </div>
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {view === "list" ? <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-y-2 text-left">
                <colgroup><col style={{width:"36%"}} /><col style={{width:"18%"}} /><col style={{width:"25%"}} /><col style={{width:"12%"}} /><col style={{width:"9%"}} /></colgroup>
                <thead className="text-xs uppercase tracking-wider text-stone-500">
                  <tr><th className="px-4 py-3 font-medium">{t("Item")}</th><th className="px-4 py-3 font-medium">{t("Category")}</th><th className="px-4 py-3 font-medium">{t("Stock")}<span className="mt-1 block text-[10px] normal-case tracking-normal">{t("Current")} / {t("Minimum")}</span></th><th className="px-4 py-3 font-medium">{t("Status")}</th><th className="px-4 py-3 font-medium">{t("Supplier")}</th></tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="p-14 text-center text-sm text-stone-500">{t("Loading current stock...")}</td></tr> : visibleRows.length===0 ? <tr><td colSpan={5} className="p-14 text-center text-sm text-stone-500">{t("No current stock found")}</td></tr> : displayRows.map(({ingredient,current,known,metadata,minimum,target,out,low,choices,choice,progress,section,Icon,packagingInfo,stockValue}) => {
                    return <tr key={ingredient.ingredient_id} className="group text-sm [&>td]:bg-[var(--color-brand-surface)] [&>td]:transition-colors hover:[&>td]:bg-[var(--color-brand-soft)]">
                      <td className="rounded-l-2xl px-4 py-4">
                        <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-brand-cream)] text-[var(--color-brand-primary)]"><Icon size={20} /></span><div className="min-w-0">
                          <Link to={`/current-stock/${encodeURIComponent(ingredient.ingredient_id)}?date=${encodeURIComponent(date)}`} className="font-semibold text-[var(--color-brand-primary)] hover:underline">{ingredient.name}</Link>
                          <p className="mt-1 text-xs leading-relaxed text-stone-500">{[ingredient.ingredient_id,metadata?.brand,packagingInfo,stockValue].filter(Boolean).join(" · ")}</p>
                        </div></div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">{[section,metadata?.subcategory].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-4">
                        <p className="whitespace-nowrap font-semibold text-[var(--color-brand-primary)]">{known ? formatQuantity(current/choice.divisor,choice.label) : "Stok belum diketahui"} <span className="text-xs font-normal text-stone-500" title={t("Minimum stock")}>/ {ingredient.minimum_stock ? formatQuantity(minimum/choice.divisor,choice.label) : "—"}</span></p>
                        <p className="mt-1 text-xs text-stone-500">{t("Target stock")}: {target > 0 ? formatQuantity(target/choice.divisor,choice.label) : "—"}</p>
                        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-cream)]"><div className={`h-full rounded-full ${out ? "bg-red-400" : low ? "bg-amber-500" : "bg-[var(--color-brand-accent)]"}`} style={{width:`${progress}%`}} /></div>
                        <div className="mt-2 flex flex-wrap gap-1">{choices.map((option) => <button key={option.key} type="button" aria-pressed={choice.key===option.key} onClick={() => setDisplayUnits((values) => ({...values,[ingredient.ingredient_id]:option.key}))} className={`rounded-full border border-[var(--color-brand-primary)] px-2 py-0.5 text-[10px] font-medium ${choice.key===option.key ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-cream)]" : "text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-sage)]"}`}>{option.label}</button>)}</div>
                      </td>
                      <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${out ? "bg-red-100 text-red-800" : low ? "bg-yellow-200 text-yellow-900" : "bg-[var(--color-brand-sage)] text-[var(--color-brand-primary)]"}`}>{!known ? "Belum diketahui" : t(out ? "Out of stock" : low ? "Low stock" : "In stock")}</span></td>
                      <td className="rounded-r-2xl px-4 py-4 text-stone-600">{metadata?.supplier || "—"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div> : loading ? <p className="p-14 text-center text-sm text-stone-500">{t("Loading current stock...")}</p> : displayRows.length===0 ? <p className="p-14 text-center text-sm text-stone-500">{t("No current stock found")}</p> : <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-6">
              {displayRows.map(({ingredient,current,known,metadata,minimum,target,out,low,choices,choice,progress,section,Icon,packagingInfo,stockValue}) => <article key={ingredient.ingredient_id} className="flex min-w-0 flex-col rounded-2xl bg-[var(--color-brand-surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full text-[var(--color-brand-primary)] ${out ? "bg-red-200" : low ? "bg-yellow-200" : "bg-[var(--color-brand-sage)]"}`}><Icon size={20} /></span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${out ? "bg-red-100 text-red-800" : low ? "bg-yellow-200 text-yellow-900" : "bg-[var(--color-brand-sage)] text-[var(--color-brand-primary)]"}`}>{!known ? "Belum diketahui" : t(out ? "Out of stock" : low ? "Low stock" : "In stock")}</span>
                </div>
                <div className="mt-4 min-h-24">
                  <Link to={`/current-stock/${encodeURIComponent(ingredient.ingredient_id)}?date=${encodeURIComponent(date)}`} className="text-sm font-semibold text-[var(--color-brand-primary)] hover:underline">{ingredient.name}</Link>
                  <p className="mt-1 break-words text-xs leading-relaxed text-stone-500">{[section,metadata?.subcategory,ingredient.ingredient_id,metadata?.brand,packagingInfo].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="mt-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-1"><p className="text-xl font-semibold text-[var(--color-brand-primary)]">{known ? formatQuantity(current/choice.divisor,choice.label) : "Stok belum diketahui"}</p><p className="text-[10px] text-stone-500">{t("Minimum")}: {ingredient.minimum_stock ? formatQuantity(minimum/choice.divisor,choice.label) : "—"}</p></div>
                  <p className="mt-1 text-[10px] text-stone-500">{t("Target stock")}: {target > 0 ? formatQuantity(target/choice.divisor,choice.label) : "—"}</p>
                  <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-cream)]"><div className={`h-full rounded-full ${out ? "bg-red-400" : low ? "bg-amber-500" : "bg-[var(--color-brand-accent)]"}`} style={{width:`${progress}%`}} /></div>
                  <div className="mt-2 flex flex-wrap gap-1">{choices.map((option) => <button key={option.key} type="button" aria-pressed={choice.key===option.key} onClick={() => setDisplayUnits((values) => ({...values,[ingredient.ingredient_id]:option.key}))} className={`rounded-full border border-[var(--color-brand-primary)] px-2 py-0.5 text-[10px] font-medium ${choice.key===option.key ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-cream)]" : "text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-sage)]"}`}>{option.label}</button>)}</div>
                </div>
                <p className="mt-4 break-words text-xs text-stone-500">{[metadata?.supplier,stockValue].filter(Boolean).join(" · ") || "—"}</p>
                <Link to={`/current-stock/${encodeURIComponent(ingredient.ingredient_id)}?date=${encodeURIComponent(date)}`} className="mt-4 block rounded-full bg-[var(--color-brand-cream)] px-3 py-2 text-center text-xs font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-sage)]">{t("View details")}</Link>
              </article>)}
            </div>}
          </section>
        </main>
      </section>
    </div>
  );
}
