import { useState } from "react";
import { AlertTriangle, ChartNoAxesCombined } from "lucide-react";

type Row = { section: string; out: boolean; low: boolean };
const colors = ["#73965a", "#d6b84e", "#d78e7c"];

type ChartText = {
 labels: string[]; title: string; description: string; priorityTitle: string; priorityDescription: string;
 priorityLabel: string; centerLabel: string; footer: string; empty: string;
};
export function StockStatusCharts({ rows, loading, text }: { rows: Row[]; loading: boolean; text: ChartText }) {
  const statusLabels = text.labels;
  const [highlight, setHighlight] = useState<number | null>(null);
  const counts = [rows.filter((row) => !row.out && !row.low).length, rows.filter((row) => row.low).length, rows.filter((row) => row.out).length];
  const total = rows.length;
  const restock = counts[1] + counts[2];
  const groups = Array.from(new Set(rows.map((row) => row.section || "Tanpa kategori"))).map((section) => {
    const items = rows.filter((row) => (row.section || "Tanpa kategori") === section);
    return { section, total: items.length, low: items.filter((row) => row.low).length, out: items.filter((row) => row.out).length };
  }).sort((a, b) => b.low + b.out - a.low - a.out || a.section.localeCompare(b.section));
  const circumference = 2 * Math.PI * 62;
  let offset = 0;
  return <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label={text.title}>
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold text-brand-primary"><ChartNoAxesCombined size={18} />{text.title}</h2><p className="mt-1 text-xs text-stone-500">{text.description}</p></div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-primary">{loading ? "…" : total} item</span>
      </div>
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-xl bg-brand-soft/60" aria-label="Memuat grafik stok" /> : !total ? <p className="py-16 text-center text-sm text-stone-500">{text.empty}</p> : <div className="mt-4 flex flex-wrap items-center justify-center gap-5 sm:justify-start">
        <div className="relative size-44 shrink-0">
          <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={counts.map((count, index) => `${statusLabels[index]}: ${count} item`).join(", ")}>
            <circle cx="80" cy="80" r="62" fill="none" stroke="#e8f0d6" strokeWidth="17" />
            {counts.map((count, index) => {
              const length = count / total * circumference;
              const start = offset;
              offset += length;
              return count > 0 ? <circle key={index} cx="80" cy="80" r="62" fill="none" stroke={colors[index]} strokeWidth={highlight === index ? 21 : 17} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} className="transition-all" opacity={highlight === null || highlight === index ? 1 : 0.35} onMouseEnter={() => setHighlight(index)} onMouseLeave={() => setHighlight(null)} /> : null;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true"><p className="text-3xl font-bold text-brand-primary">{highlight === null ? Math.round(counts[0] / total * 100) : counts[highlight]}</p><p className="mt-1 max-w-24 text-xs text-stone-500">{highlight === null ? text.centerLabel : statusLabels[highlight]}</p></div>
        </div>
        <div className="min-w-44 flex-1 space-y-2">
          {counts.map((count, index) => <button key={index} type="button" aria-pressed={highlight === index} onClick={() => setHighlight(highlight === index ? null : index)} onMouseEnter={() => setHighlight(index)} onMouseLeave={() => setHighlight(null)} onFocus={() => setHighlight(index)} onBlur={() => setHighlight(null)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm hover:bg-brand-soft focus-visible:outline-brand-primary">
            <span className="flex items-center gap-2 text-stone-600"><span className="size-2.5 rounded-full" style={{ background: colors[index] }} />{statusLabels[index]}</span><span className="font-semibold text-brand-primary">{count}<span className="ml-2 text-xs font-normal text-stone-400">{Math.round(count / total * 100)}%</span></span>
          </button>)}
        </div>
      </div>}
    </article>
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold text-brand-primary"><AlertTriangle size={18} />{text.priorityTitle}</h2><p className="mt-1 text-xs text-stone-500">{text.priorityDescription}</p></div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${restock ? "bg-yellow-100 text-yellow-900" : "bg-brand-soft text-brand-primary"}`}>{loading ? "…" : restock} {text.priorityLabel}</span>
      </div>
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-xl bg-brand-soft/60" aria-label="Memuat prioritas restok" /> : !total ? <p className="py-16 text-center text-sm text-stone-500">{text.empty}</p> : <>
        <div className="mt-6 space-y-4">
          {groups.map((group) => <div key={group.section}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="font-semibold text-brand-primary">{group.section}</span><span className="text-xs text-stone-500"><b className="text-brand-primary">{group.low + group.out}</b> / {group.total} item {text.priorityLabel}</span></div>
            <div className="flex h-3 overflow-hidden rounded-full bg-brand-soft" role="img" aria-label={`${group.section}: ${group.low} ${statusLabels[1]}, ${group.out} ${statusLabels[2]}, dari ${group.total} item`}>
              <div style={{ width: `${group.out / group.total * 100}%`, background: colors[2] }} title={`${group.out} ${statusLabels[2]}`} /><div style={{ width: `${group.low / group.total * 100}%`, background: colors[1] }} title={`${group.low} ${statusLabels[1]}`} />
            </div>
          </div>)}
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-stone-500">{[1, 2].map((index) => <span key={index} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: colors[index] }} />{statusLabels[index]}</span>)}</div>
        <p className="mt-4 text-xs leading-relaxed text-stone-500">{text.footer}</p>
      </>}
    </article>
  </section>;
}

export default function CurrentStockCharts(props: { rows: Row[]; loading: boolean }) {
 return <StockStatusCharts {...props} text={{ labels: ["Stok tersedia", "Stok rendah", "Stok habis"], title: "Kondisi stok", description: "Jumlah item berdasarkan status stok.", priorityTitle: "Prioritas restok", priorityDescription: "Item rendah atau habis per bagian, sesuai filter.", priorityLabel: "perlu restok", centerLabel: "% item tersedia", footer: "Stok rendah = di bawah minimum. Stok habis = jumlah 0 atau kurang. Grafik membandingkan jumlah item, bukan campuran GR, ML, dan PCS.", empty: "Belum ada item untuk filter ini." }} />;
}
