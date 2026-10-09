import * as XLSX from "xlsx-js-style";
import { getRecipes, getRecipeCost, type Recipe, type RecipeCost } from "../api/recipe.api";
import { getProducts, type Product } from "../api/product.api";
import { getCategories } from "../api/category.api";
import { createExportWorksheet } from "./exportWorksheet";
import { currentBusinessDate } from "./businessDate";

type ReportEntry = { recipe: Recipe; cost: RecipeCost; product?: Product; category: string };
const numeric = (value: string | null | undefined) => value == null || value === "" ? null : Number(value);

function formatSheet(sheet: XLSX.WorkSheet, moneyColumns: number[]) {
  if (!sheet["!ref"]) return;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let row = 1; row <= range.e.r; row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cell = sheet[XLSX.utils.encode_cell({r: row, c: col})];
      if (!cell) continue;
      cell.s = { ...cell.s, alignment: { horizontal: cell.t === "n" ? "right" : "left", vertical: "center", wrapText: true } };
      if (cell.t === "n") {
        const decimals = Math.min(3, (String(cell.v).split(".")[1] || "").length);
        cell.z = moneyColumns.includes(col) || !decimals ? "#,##0" : `#,##0.${"0".repeat(decimals)}`;
      }
    }
  }
  sheet["!autofilter"] = { ref: sheet["!ref"] };
}

export function buildRecipeHppWorkbook(entries: ReportEntry[]) {
  const book = XLSX.utils.book_new();
  const summary = createExportWorksheet(
    ["Kategori menu", "Kategori resep", "Menu / base", "Jenis resep", "Versi", "Status resep", "Total HPP (Rp)", "Qty awal", "Satuan awal", "Hasil akhir", "Satuan hasil", "HPP per satuan (Rp)", "Qty pemakaian base", "Status HPP", "Catatan"],
    entries.map(({recipe, cost, product, category}) => [category, recipe.recipe_category || "", product?.name || "Menu tidak ditemukan", recipe.is_base ? "Base racikan" : "Resep menu", recipe.version, recipe.active ? "Aktif" : "Nonaktif", cost.complete ? numeric(cost.total_cost) : null, numeric(cost.initial_quantity), cost.initial_unit, numeric(cost.yield_quantity), cost.yield_unit, cost.complete ? numeric(cost.unit_cost) : null, recipe.is_base ? numeric(recipe.serving_quantity || recipe.yield_quantity) : null, cost.complete ? "Lengkap" : "Belum lengkap", cost.issues.join("; ")]),
    [22, 20, 32, 18, 26, 14, 22, 16, 18, 16, 16, 24, 23, 18, 55],
  );
  formatSheet(summary, [6, 11]);
  XLSX.utils.book_append_sheet(book, summary, "Ringkasan HPP");

  const rows: (string | number | null)[][] = [];
  const totals: number[] = [];
  for (const {recipe, cost, product, category} of entries) {
    for (const item of cost.components) rows.push([category, recipe.recipe_category || "", product?.name || "Menu tidak ditemukan", recipe.is_base ? "Base racikan" : "Resep menu", recipe.version, recipe.active ? "Aktif" : "Nonaktif", item.name, numeric(item.quantity), item.unit, numeric(item.purchase_price), numeric(item.purchase_quantity), item.purchase_unit || "", numeric(item.unit_cost), numeric(item.cost), item.issue || ""]);
    totals.push(rows.length + 1);
    rows.push([`TOTAL HPP · ${product?.name || "Menu tidak ditemukan"} · ${recipe.version}`, "", "", "", "", "", "", null, "", null, null, "", null, cost.complete ? numeric(cost.total_cost) : "HPP belum lengkap", cost.issues.join("; ")]);
  }
  const details = createExportWorksheet(["Kategori menu", "Kategori resep", "Menu / base", "Jenis resep", "Versi", "Status resep", "Item / base", "Qty resep", "Satuan", "Harga acuan (Rp)", "Qty acuan", "Satuan acuan", "HPP per satuan (Rp)", "HPP item (Rp)", "Catatan"], rows, [22, 20, 32, 18, 26, 14, 48, 16, 12, 22, 16, 16, 24, 22, 55]);
  formatSheet(details, [9, 12, 13]);
  delete details["!autofilter"];
  details["!merges"] = totals.map((row) => ({s: {r: row, c: 0}, e: {r: row, c: 12}}));
  for (const row of totals) for (let col = 0; col < 15; col++) {
    const address = XLSX.utils.encode_cell({r: row, c: col});
    const cell = details[address] || (details[address] = {t: "s", v: ""});
    cell.s = {...cell.s, font: {bold: true, color: {rgb: "244510"}}, fill: {patternType: "solid", fgColor: {rgb: "E7EED9"}}};
  }
  XLSX.utils.book_append_sheet(book, details, "Rincian HPP");
  XLSX.utils.book_append_sheet(book, createExportWorksheet(["Keterangan", "Nilai"], [
    ["Tanggal ekspor", currentBusinessDate()], ["Cakupan", "Semua resep menu dan base racikan, semua kategori dan versi, aktif maupun nonaktif"], ["Jumlah resep", entries.length], ["HPP lengkap", entries.filter((entry) => entry.cost.complete).length], ["HPP belum lengkap", entries.filter((entry) => !entry.cost.complete).length],
    ["Sumber HPP", "Perhitungan HPP resep dengan harga aktif saat laporan ditarik. Base mengikuti biaya racikan, hasil akhir, dan qty pemakaian pada resep."],
    ["Angka", "Harga dan HPP ditampilkan bulat dengan pemisah ribuan. Nilai angka tersimpan tetap presisi untuk perhitungan Excel."],
    ["Catatan", "HPP yang belum lengkap dibiarkan kosong pada ringkasan dan diberi alasan. HPP menu per porsi dan HPP base per racikan tidak dijumlahkan bersama."],
  ], [30, 105]), "Informasi");
  return book;
}

async function allPages<T>(fetchPage: (start: number) => Promise<{data?: T[] | null}>) {
  const items: T[] = [];
  for (let start = 0; ; start += 100) {
    const page = (await fetchPage(start)).data || [];
    items.push(...page);
    if (page.length < 100) return items;
  }
}

export async function exportAllRecipeHpp(onProgress: (done: number, total: number) => void) {
  const [recipes, products, categories] = await Promise.all([
    allPages((start) => getRecipes({start, limit: 100, name: "", product_id: ""})),
    allPages((start) => getProducts({start, limit: 100, name: "", category_id: ""})),
    allPages((start) => getCategories({start, limit: 100, name: ""})),
  ]);
  if (!recipes.length) throw new Error("Belum ada data resep untuk diekspor.");
  const productMap = new Map(products.map((product) => [product.product_id, product]));
  const categoryMap = new Map(categories.map((category) => [category.category_id, category.name]));
  const entries: ReportEntry[] = new Array(recipes.length);
  let next = 0;
  let done = 0;
  let failed = false;
  onProgress(0, recipes.length);
  const results = await Promise.allSettled(Array.from({length: Math.min(4, recipes.length)}, async () => {
    while (!failed && next < recipes.length) {
      const index = next++;
      const recipe = recipes[index];
      let cost: RecipeCost | null | undefined;
      try {
        cost = (await getRecipeCost(recipe.recipe_id)).data;
        if (!cost) throw new Error(`HPP ${recipe.version} gagal dimuat. Export dibatalkan; coba lagi.`);
      } catch (error) { failed = true; throw error; }
      const product = productMap.get(recipe.product_id) || recipe.product_info;
      entries[index] = {recipe, cost, product, category: product ? categoryMap.get(product.category_id) || product.category_info?.name || "Kategori tidak ditemukan" : "Kategori tidak ditemukan"};
      onProgress(++done, recipes.length);
    }
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  entries.sort((a, b) => a.category.localeCompare(b.category) || (a.product?.name || "").localeCompare(b.product?.name || "") || Number(Boolean(a.recipe.is_base)) - Number(Boolean(b.recipe.is_base)) || a.recipe.version.localeCompare(b.recipe.version));
  XLSX.writeFile(buildRecipeHppWorkbook(entries), `HPP-Semua-Resep-${currentBusinessDate()}.xlsx`);
}
