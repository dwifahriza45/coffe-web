import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../app/LanguageContext";

export interface ImportResultRow {
  row: number;
  name: string;
  status: "success" | "failed" | "skipped";
  reason: string;
}

export default function ImportResults<T extends ImportResultRow>({
  details,
  columns = [],
  showSkipped = false,
}: {
  details: T[] | null;
  columns?: { label: string; render: (row: T) => ReactNode }[];
  showSkipped?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const detailButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => setOpen(false), [details]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      detailButton.current?.focus();
    };
  }, [open]);
  if (!details) return null;
  const success = details.filter((item) => item.status === "success").length;
  const failed = details.filter((item) => item.status === "failed").length;
  const skipped = details.filter((item) => item.status === "skipped").length;
  const summary = <>{t("Success")} {success}, {t("Failed")} {failed}{(showSkipped || skipped > 0) && <>, {t("Skipped")} {skipped}</>}</>;
  return (
    <>
      <div className="m-4 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="font-semibold">{t("Import finished")}: {summary}</p>
        <button ref={detailButton} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="self-start rounded-lg border border-green-300 px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-100 sm:self-auto">{t("Detail")}</button>
      </div>
      {open && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div><h2 id={titleId} className="text-lg font-bold">{t("Import detail")}</h2><p className="mt-1 text-sm text-stone-500">{summary}</p></div>
              <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="overflow-auto p-5">
              <table className={`w-full text-left ${columns.length ? "min-w-220" : "min-w-[600px]"}`}>
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr>
                  {["Row", "Name", ...columns.map((column) => column.label), "Status", "Reason"].map((label) => <th key={label} className="px-4 py-3">{t(label)}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-stone-100">{details.map((item, index) => <tr key={`${item.row}-${index}`}>
                  <td className="px-4 py-3 text-sm font-semibold">{item.row || "-"}</td>
                  <td className="px-4 py-3 text-sm">{item.name || "-"}</td>
                  {columns.map((column) => <td key={column.label} className="px-4 py-3 text-sm">{column.render(item)}</td>)}
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "success" ? "bg-green-50 text-green-700" : item.status === "failed" ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{t(item.status === "success" ? "Success" : item.status === "failed" ? "Failed" : "Skipped")}</span></td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.reason}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t border-stone-200 p-5"><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white">{t("Close")}</button></footer>
          </section>
        </div>, document.body,
      )}
    </>
  );
}
