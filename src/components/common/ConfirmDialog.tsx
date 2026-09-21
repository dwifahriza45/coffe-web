import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type ConfirmTone = "default" | "danger";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  tone = "default",
  submitting = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  tone?: ConfirmTone;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const danger = tone === "danger";
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <section className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between p-5">
          <div className="flex gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-700" : "bg-[#f2e2d8] text-[#92502f]"}`}
            >
              {danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                {message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>
        <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-700" : "bg-[#362219]"}`}
          >
            {submitting ? "Saving..." : confirmText}
          </button>
        </footer>
      </section>
    </div>
  );
}
