import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Download } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { getRecipeCost, type RecipeCost } from "../../api/recipe.api";
import { formatNumber, formatNumberInput, normalizeNumberInput } from "../../utils/numberFormat";
import { createExportWorksheet } from "../../utils/exportWorksheet";

const money = (value: string | null, digits = 2) =>
  value === null ? "Belum lengkap" : `Rp ${formatNumber(value, digits)}`;
const quantity = (value: string | null | undefined, unit = "") =>
  value == null || value === "" ? "—" : `${formatNumber(value, 3)} ${unit}`;
export default function RecipeCostPanel({
  recipeID,
  name,
  version,
  isBase,
  refreshKey,
  onSaveYield,
}: {
  recipeID: string;
  name: string;
  version: string;
  isBase: boolean;
  refreshKey: number;
  onSaveYield?: (quantity: string, unit: string) => Promise<void>;
}) {
  const [yieldValue, setYieldValue] = useState("");
  const [yieldUnit, setYieldUnit] = useState("ml");
  const [savingYield, setSavingYield] = useState(false);
  const [yieldError, setYieldError] = useState("");
  const [cost, setCost] = useState<RecipeCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setCost(null);
    getRecipeCost(recipeID)
      .then((response) => {
        if (current) { setCost(response.data ?? null); setYieldValue(response.data?.yield_quantity ? String(Math.round(Number(response.data.yield_quantity))) : ""); setYieldUnit(response.data?.yield_unit || "ml"); setYieldError(""); }
      })
      .catch((requestError) => {
        if (current)
          setError(
            isAxiosError<{ message?: string }>(requestError)
              ? requestError.response?.data?.message || "HPP belum bisa dimuat."
              : "HPP belum bisa dimuat.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [recipeID, refreshKey]);
  function exportCost() {
    if (!cost) return;
    const number = (value: string | null) =>
      value === null || value === "" ? null : Number(value);
    const rows = cost.components.map((item) => [
      name,
      version,
      item.name,
      number(item.quantity),
      item.unit,
      number(item.purchase_price),
      number(item.purchase_quantity),
      item.purchase_unit ?? "",
      number(item.unit_cost),
      number(item.cost),
      item.issue ?? "",
    ]);
    rows.push(["TOTAL HPP", "", "", null, "", null, null, "", null, cost.complete ? number(cost.total_cost) : "HPP belum lengkap", ""]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      createExportWorksheet(
        [
          "Menu / base",
          "Versi",
          "Item",
          "Qty resep",
          "Satuan",
          "Harga acuan (Rp)",
          "Qty acuan",
          "Satuan acuan",
          "HPP per satuan (Rp)",
          "HPP item (Rp)",
          "Catatan",
        ],
        rows,
        [26, 20, 48, 16, 12, 22, 16, 18, 24, 22, 50],
      ),
      "Rincian HPP",
    );
    XLSX.utils.book_append_sheet(
      book,
      createExportWorksheet(
        ["Keterangan", "Nilai"],
        [
          ["Menu / base", name],
          ["Versi", version],
          ["Status HPP", cost.complete ? "Lengkap" : "Belum lengkap"],
          [
            isBase ? "Total HPP per racikan (Rp)" : "HPP per porsi (Rp)",
            number(cost.total_cost),
          ],
          ["Total qty awal (otomatis)", number(cost.initial_quantity)],
          ["Selisih qty awal / akhir", number(cost.waste_quantity)],
          ["Satuan qty awal", cost.initial_unit],
          ["Hasil akhir", number(cost.yield_quantity)],
          ["Satuan hasil akhir", cost.yield_unit],
          [
            isBase ? "HPP per satuan hasil (Rp)" : "HPP per porsi (Rp)",
            number(cost.unit_cost),
          ],
          [
            "Dasar harga",
            "Harga aktif item saat ini. HPP mencakup komponen resep yang dicatat.",
          ],
          ["Catatan", cost.issues.join("; ")],
        ],
        [38, 90],
      ),
      "Ringkasan",
    );
    for (const sheetName of book.SheetNames) {
      const sheet = book.Sheets[sheetName];
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith("!")) continue;
        if (cell.t === "n") {
          const { r, c } = XLSX.utils.decode_cell(address);
          const currency = sheetName === "Rincian HPP" ? [5, 8, 9].includes(c) : String(sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v ?? "").includes("(Rp)");
          const decimals = (String(Number(Number(cell.v).toFixed(3))).split(".")[1] ?? "").length;
          cell.z = currency || decimals === 0 ? "#,##0" : `#,##0.${"0".repeat(decimals)}`;
          cell.s = { ...cell.s, alignment: { horizontal: "right", vertical: "center" } };
        } else {
          cell.s = { ...cell.s, alignment: { ...cell.s?.alignment, wrapText: true } };
        }
      }
    }
    const detail = book.Sheets["Rincian HPP"];
    const totalRow = rows.length;
    detail["!merges"] = [...(detail["!merges"] ?? []), { s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 8 } }];
    for (let column = 0; column < 11; column++) {
      const cell = detail[XLSX.utils.encode_cell({ r: totalRow, c: column })];
      if (!cell) continue;
      cell.s = { ...cell.s, font: { bold: true, color: { rgb: "244510" } }, fill: { patternType: "solid", fgColor: { rgb: "E7EED9" } } };
    }
    XLSX.writeFile(book, `hpp-${recipeID}.xlsx`);
  }
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
        <div>
          <h2 className="font-semibold">HPP · {version}</h2>
          <p className="mt-1 text-xs text-stone-500">
            Harga aktif item × takaran resep. Base dihitung dari biaya racikan
            ÷ hasil akhir.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || !cost}
          onClick={exportCost}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <Download size={15} />
          Ekspor HPP
        </button>
      </header>
      {loading ? (
        <p className="p-5 text-sm text-stone-500">Menghitung HPP…</p>
      ) : error ? (
        <p className="p-5 text-sm text-red-700">{error}</p>
      ) : (
        cost && (
          <>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--color-brand-cream)] p-4">
                <p className="text-xs font-semibold text-stone-500">
                  {isBase ? "Total HPP satu racikan" : "HPP satu porsi"}
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--color-brand-primary)]">
                  {money(cost.total_cost)}
                </p>
              </div>
              {isBase && (
                <div className="rounded-xl bg-stone-50 p-4">
                  <p className="text-xs font-semibold text-stone-500">
                    HPP per {cost.yield_unit || "satuan hasil"}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {cost.unit_cost === null
                      ? "Belum bisa dihitung"
                      : money(cost.unit_cost, 4)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Total HPP ÷ {quantity(cost.yield_quantity, cost.yield_unit)}
                  </p>
                </div>
              )}
            </div>
            {isBase && (
              <div className="mx-4 mb-4 grid grid-cols-3 gap-3 rounded-xl border border-stone-200 p-3 text-sm">
                <div>
                  <p className="text-xs text-stone-500">Total qty awal</p>
                  <p className="mt-1 font-semibold">
                    {quantity(cost.initial_quantity, cost.initial_unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">{cost.initial_mixed ? "Selisih qty" : "Waste / susut"}</p>
                  <p className="mt-1 font-semibold">
                    {quantity(cost.waste_quantity, cost.initial_unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Hasil akhir</p>
                  {onSaveYield ? <form className="mt-2 space-y-2" onSubmit={async (event) => {
                    event.preventDefault(); if (savingYield) return;
                    if (!(Math.round(Number(yieldValue)) > 0)) { setYieldError("Isi hasil akhir lebih dari 0."); return; }
                    setSavingYield(true); setYieldError("");
                    try { await onSaveYield(String(Math.round(Number(yieldValue))), yieldUnit); }
                    catch (err) { setYieldError(isAxiosError<{message?:string}>(err) ? err.response?.data?.message || "Gagal menyimpan hasil akhir" : "Gagal menyimpan hasil akhir"); }
                    finally { setSavingYield(false); }
                  }}><div className="flex flex-wrap gap-2"><input aria-label="Jumlah hasil akhir base" required inputMode="decimal" value={formatNumberInput(yieldValue)} onBlur={() => { if (yieldValue) setYieldValue(String(Math.round(Number(yieldValue)))); }} onChange={(e) => setYieldValue(normalizeNumberInput(e.target.value))} disabled={savingYield} className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 px-3" /><select aria-label="Satuan hasil akhir base" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} disabled={savingYield || Boolean(cost.yield_unit)} className="h-10 rounded-lg border border-stone-300 px-2"><option value="ml">ml</option><option value="gr">gr</option></select></div><button disabled={savingYield || !yieldValue || (Number(yieldValue) === Number(cost.yield_quantity) && yieldUnit === cost.yield_unit)} className="rounded-lg bg-[var(--color-brand-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{savingYield ? "Menyimpan…" : "Simpan hasil akhir"}</button>{yieldError && <p role="alert" className="text-xs text-red-700">{yieldError}</p>}<p className="text-xs text-stone-500">Input hasil racikan yang kamu ukur. HPP diperbarui setelah disimpan.</p></form> : <p className="mt-1 font-semibold">{quantity(cost.yield_quantity, cost.yield_unit)}</p>}
                </div>
              </div>
            )}
            {isBase && cost.initial_mixed && <p className="mx-4 mb-4 text-xs text-stone-500">Qty awal mengikuti jumlah komposisi GR + ML. Selisih qty ini adalah acuan racikan; hasil akhir diukur terpisah dan dipakai sebagai pembagi HPP.</p>}
            {cost.issues.length > 0 && (
              <div className="mx-4 mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                <ul className="list-disc space-y-1 pl-4">
                  {cost.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Item / base</th>
                    <th className="px-4 py-3 text-right">Qty resep</th>
                    <th className="px-4 py-3 text-right">Harga acuan</th>
                    <th className="px-4 py-3 text-right">Isi acuan</th>
                    <th className="px-4 py-3 text-right">HPP / satuan</th>
                    <th className="px-4 py-3 text-right">HPP item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {cost.components.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{item.name}</p>
                        {item.base_recipe_id && (
                          <small className="text-stone-500">Base racikan</small>
                        )}
                        {item.issue && (
                          <p className="mt-1 text-xs text-amber-800">
                            {item.issue}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {quantity(item.quantity, item.unit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {item.purchase_price === null
                          ? "—"
                          : money(item.purchase_price)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {quantity(
                          item.purchase_quantity,
                          item.purchase_unit ?? "",
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{money(item.unit_cost)} / {item.unit}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {money(item.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-stone-200 p-4 text-xs leading-relaxed text-stone-500">
              HPP mencakup item dan komponen yang dimasukkan ke resep. Tenaga
              kerja, listrik, dan biaya operasional belum termasuk. Qty awal dihitung otomatis dari komposisi. HPP base dibagi hasil akhir yang diukur.
            </p>
          </>
        )
      )}
    </section>
  );
}
