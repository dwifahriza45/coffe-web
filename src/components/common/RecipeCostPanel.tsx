import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Download } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { getRecipeCost, type RecipeCost } from "../../api/recipe.api";
import { formatNumber } from "../../utils/numberFormat";
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
}: {
  recipeID: string;
  name: string;
  version: string;
  isBase: boolean;
  refreshKey: number;
}) {
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
        if (current) setCost(response.data ?? null);
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
        [26, 20, 30, 16, 12, 22, 16, 18, 24, 22, 50],
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
          ["Jumlah sebelum susut", number(cost.initial_quantity)],
          ["Waste / susut", number(cost.waste_quantity)],
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
                  <p className="text-xs text-stone-500">Sebelum susut</p>
                  <p className="mt-1 font-semibold">
                    {quantity(cost.initial_quantity, cost.yield_unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Waste / susut</p>
                  <p className="mt-1 font-semibold">
                    {quantity(cost.waste_quantity, cost.yield_unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Hasil akhir</p>
                  <p className="mt-1 font-semibold">
                    {quantity(cost.yield_quantity, cost.yield_unit)}
                  </p>
                </div>
              </div>
            )}
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
              kerja, listrik, dan biaya operasional belum termasuk. Waste
              memakai jumlah sebelum susut dan hasil akhir yang dicatat, tanpa
              menjumlahkan gram dan ml.
            </p>
          </>
        )
      )}
    </section>
  );
}
