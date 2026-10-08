import { getStockAdjustments } from "../api/stockAdjustment.api";
import { getStockAdjustmentItems } from "../api/stockAdjustmentItem.api";
import * as XLSX from "xlsx-js-style";
import { getStockCountSections, type InventoryCount } from "../api/inventoryCount.api";
import { getInventoryCountItems } from "../api/inventoryCountItem.api";
import { getStockMovements } from "../api/stockMovement.api";
import { createExportWorksheet } from "./exportWorksheet";
import { getStockCountDepartment } from "./stockCountDepartment";
import { stockRecap } from "./stockRecap";

const number = (value: string | null | undefined): number | null => value == null || value === "" ? null : Number(value);

export async function exportStockCountReport(input: {
  counts: InventoryCount[]; dayID: string; date: string; department?: string;
}) {
  const book = XLSX.utils.book_new();
  const report = await Promise.all([...input.counts].sort((a, b) => (a.count_type === "OPENING" ? 0 : 1) - (b.count_type === "OPENING" ? 0 : 1)).map(async (count) => {
    const [sectionResponse, items] = await Promise.all([
      getStockCountSections(count.inventory_count_id),
      (async () => {
        const all = [];
        for (let start = 0; ; start += 100) {
          const response = await getInventoryCountItems({ start, limit: 100, inventory_count_id: count.inventory_count_id, ingredient_id: "", name: "" });
          const batch = response.data ?? [];
          all.push(...batch);
          if (batch.length < 100 || all.length >= (response.total ?? Infinity)) break;
        }
        return all;
      })(),
    ]);
    const sections = sectionResponse.data?.sections ?? [];
    const balances = sectionResponse.data?.balances ?? [];
    const rows = items.filter((item) => !input.department || item.department === input.department).map((item) => {
      const balance = balances.find((entry) => entry.item_id === item.inventory_count_item_id);
      const unit = item.stock_unit || item.ingredient_info?.base_unit_info?.code || "";
      const closing = count.count_type === "CLOSING";
      const physical = number(item.actual_quantity);
      const recap = stockRecap({ closing, waiters: item.department === "waiters", opening: number(balance?.opening), incoming: number(balance?.stock_in) ?? 0, outgoing: number(balance?.stock_out) ?? 0, adjustment: number(balance?.adjustment) ?? 0, physical, minimum: number(balance?.minimum), target: number(balance?.target), baseUnit: unit, packaging: balance?.packaging ?? "", contentUnit: balance?.content_unit ?? "", contentQty: number(balance?.content_qty) ?? 0, packageQty: number(balance?.package_qty) ?? 0 });
      return [input.date, getStockCountDepartment(item.department)?.label ?? "Belum dipisah", sections.find((section) => section.department === item.department)?.status ?? count.status, item.ingredient_info?.name ?? item.ingredient_id, balance?.brand ?? "", unit, closing ? number(balance?.opening) : physical, closing ? number(balance?.stock_in) ?? 0 : null, closing ? number(balance?.adjustment) ?? 0 : null, recap.consumption, recap.expected, closing ? physical : null, recap.variance, recap.variance === null ? null : Math.abs(recap.variance) < 0.0005, number(item.valuation_unit_price), number(item.stock_value), item.notes, recap.invalid ? "Pemakaian negatif: perlu diperiksa" : item.department === "waiters" && closing ? "Pemakaian dari fisik, termasuk Waste" : ""];
    });
    return { count, rows, sections };
  }));
  XLSX.utils.book_append_sheet(book, createExportWorksheet(["Informasi", "Nilai"], [
    ["Tanggal business day", input.date], ["Bagian", getStockCountDepartment(input.department ?? "")?.label ?? "Semua bagian"],
    ["Diekspor pada", new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })],
    ["Catatan", "Draft bersifat sementara. Sel kosong berarti data belum tersedia. Pemakaian Barista/Kitchen mencakup order dan Waste; Waiters dihitung dari fisik."],
  ], [28, 100]), "Informasi");
  for (const { count, rows } of report) {
    XLSX.utils.book_append_sheet(book, createExportWorksheet(["Tanggal", "Bagian", "Status", "Item", "Brand", "Satuan", "Stock awal", "Stock masuk", "Penyesuaian", "Pemakaian", "Stock sistem", "Stock akhir fisik", "Selisih", "Balance", "Harga satuan (Rp)", "Nilai stock (Rp)", "Catatan", "Keterangan"], rows, [15, 16, 16, 30, 22, 12, 18, 18, 18, 18, 18, 20, 18, 14, 22, 22, 45, 50]), count.count_type === "OPENING" ? "Stock Awal" : "Stock Akhir");
  }
  for (const name of ["Stock Awal", "Stock Akhir"]) {
    const sheet = book.Sheets[name];
    if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let row = 1; row <= range.e.r; row++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 13 })];
      if (typeof cell?.v !== "boolean") continue;
      cell.s = { ...cell.s, fill: { patternType: "solid", fgColor: { rgb: cell.v ? "C6EFCE" : "FFC7CE" } }, font: { bold: true, color: { rgb: cell.v ? "006100" : "9C0006" } } };
    }
  }
  const adjustments = [];
  for (let start = 0; ; start += 100) {
    const response = await getStockAdjustments({ start, limit: 100, business_day_id: input.dayID, business_date: input.date, department: input.department, name: "" });
    const batch = response.data ?? [];
    adjustments.push(...batch);
    if (batch.length < 100 || adjustments.length >= (response.total ?? Infinity)) break;
  }
  const adjustmentRows = (await Promise.all(adjustments.map(async (adjustment) => {
    const lines = [];
    for (let start = 0; ; start += 100) {
      const response = await getStockAdjustmentItems({ start, limit: 100, adjustment_id: adjustment.adjustment_id, ingredient_id: "", name: "" });
      const batch = response.data ?? [];
      lines.push(...batch);
      if (batch.length < 100 || lines.length >= (response.total ?? Infinity)) break;
    }
    const common = [adjustment.business_date, getStockCountDepartment(adjustment.department)?.label ?? "Belum dipisah", adjustment.adjustment_id, adjustment.status];
    return lines.length ? lines.map((line) => [...common, line.ingredient_info?.name ?? line.ingredient_id, line.adjustment_type === "IN" ? "Tambah Stok" : "Kurangi Stok", number(line.quantity), line.ingredient_info?.base_unit_info?.code ?? "", line.reason || adjustment.reason, adjustment.notes, adjustment.created_by_info?.fullname ?? adjustment.created_by, adjustment.submitted_by_info?.fullname ?? adjustment.submitted_by ?? ""])
      : [[...common, "", "", null, "", adjustment.reason, adjustment.notes, adjustment.created_by_info?.fullname ?? adjustment.created_by, adjustment.submitted_by_info?.fullname ?? adjustment.submitted_by ?? ""]];
  }))).flat();
  XLSX.utils.book_append_sheet(book, createExportWorksheet(["Tanggal", "Bagian", "Nomor penyesuaian", "Status", "Item", "Jenis", "Jumlah", "Satuan", "Alasan", "Catatan", "Dibuat oleh", "Disubmit oleh"], adjustmentRows, [15, 16, 28, 16, 30, 20, 18, 12, 45, 45, 28, 28]), "Penyesuaian");
  const movements = [];
  for (let start = 0; ; start += 100) {
    const response = await getStockMovements({ start, limit: 100, business_day_id: input.dayID, business_date: input.date, department: input.department, movement_type: "", name: "" });
    const batch = response.data ?? [];
    movements.push(...batch);
    if (batch.length < 100 || movements.length >= (response.total ?? Infinity)) break;
  }
  XLSX.utils.book_append_sheet(book, createExportWorksheet(["Tanggal", "Waktu", "Bagian", "Item", "Jenis", "Jumlah", "Satuan", "Referensi", "Nomor Stock Movement", "Dicatat oleh", "Alasan / catatan"], movements.map((item) => [item.business_date, new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }), getStockCountDepartment(item.department)?.label ?? "", item.ingredient_name, item.movement_type, number(item.quantity), item.unit_code, item.reference_type === "WASTE" ? "Waste" : item.po_number || item.reference_id, item.stock_movement_id, item.created_by_name, item.notes]), [15, 24, 16, 30, 22, 18, 12, 28, 28, 28, 50]), "Stock Movement");
  book.SheetNames = ["Informasi", "Stock Awal", "Penyesuaian", "Stock Movement", "Stock Akhir"].filter((name) => Boolean(book.Sheets[name]));
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!") || cell?.t !== "n") continue;
      const column = XLSX.utils.decode_cell(address).c;
      const currency = (name === "Stock Awal" || name === "Stock Akhir") && (column === 14 || column === 15);
      const precision = currency ? 6 : 3;
      const rounded = Number(Number(cell.v).toFixed(precision));
      const decimals = (String(rounded).split(".")[1] ?? "").length;
      cell.z = decimals === 0 ? "#,##0" : `#,##0.${"0".repeat(Math.min(decimals, precision))}`;
    }
  }
  XLSX.writeFile(book, `stock-opname-${input.date}-${input.department || "semua-bagian"}.xlsx`);
}
